
import { initPage, showToast } from '../app.js';
import { getCurrentTenant, getActivePlan } from '../../../backend-simulation/state.js';
import { getConsumerRPM, getStaffRPM } from '../../../backend-simulation/rateLimiter.js';
import { getTenantById, addStaffMember, getDailyUsage } from '../../../backend-simulation/storage.js';
import { renderPlanBadge, renderQuotaBar, renderFancyLineGraph, SVG_ICONS } from '../components.js';

let tenant = null;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initPage({
    pageName: 'my-api',
    title: 'My API Credentials & Quotas',
    subtitle: 'Manage client authentication tokens, inspect sliding-window limits, and monitor monthly usage'
  });
  if (!session) return;

  tenant = getCurrentTenant();
  if (!tenant) { showToast('No consumer associated with your session.', 'error'); return; }

  renderConsumerData();
  setupCopyButton();
  setupConsumerStaffModal();
});

function renderConsumerData() {
  const plan = getActivePlan(tenant);
  const perMinLimit = plan ? plan.perMinuteLimit : 20;

  document.getElementById('consumer-tenant-name').textContent = tenant.name;
  document.getElementById('consumer-plan-badge').innerHTML = renderPlanBadge(tenant.planId);

  const maskedKey = tenant.apiKey ? `sf_live_••••••••••••${tenant.apiKey.slice(-5)}` : 'No key available';
  document.getElementById('consumer-api-key').value = maskedKey;

  const rpm = getConsumerRPM(tenant.id, perMinLimit);
  document.getElementById('consumer-window-limit').textContent = `${perMinLimit} req/min`;

  const rpmBadge = document.getElementById('consumer-rpm-badge');
  const rpmBar = document.getElementById('consumer-rpm-progress-bar');
  const resetText = document.getElementById('consumer-rpm-reset-text');

  if (rpmBadge) {
    const badgeClass = rpm.status === 'throttled' ? 'rpm-badge-danger' : (rpm.status === 'critical' ? 'rpm-badge-warning' : 'rpm-badge-normal');
    rpmBadge.className = `rpm-badge ${badgeClass}`;
    rpmBadge.textContent = `${rpm.currentRpm} / ${rpm.limit} RPM`;
  }

  if (rpmBar) {
    barStyle(rpmBar, rpm.utilizationPercent, rpm.status);
  }

  if (resetText) {
    resetText.textContent = rpm.isThrottled
      ? `Rate limit active! Window resets in ${rpm.resetInSeconds}s (Retry-After header triggered)`
      : `Active 60-second window resets in ${rpm.resetInSeconds}s (${rpm.remainingRpm} RPM remaining)`;
  }

  const monthlyLimit = plan ? plan.monthlyLimit : 10000;
  document.getElementById('consumer-quota-bar-container').innerHTML = renderQuotaBar({
    used: tenant.monthlyUsage || 0,
    total: monthlyLimit,
    label: `${tenant.billingMonth || '2026-10'} Usage Quota`,
    showDetails: true
  });

  renderConsumerTrafficChart();
  renderConsumerStaffTable();
}

function barStyle(el, pct, status) {
  el.style.width = `${pct}%`;
  el.setAttribute('aria-valuenow', pct);
  el.className = `progress-bar ${status === 'throttled' ? 'bg-danger' : (status === 'critical' ? 'bg-warning' : 'bg-primary')}`;
}

function renderConsumerTrafficChart() {
  const chartEl = document.getElementById('consumer-traffic-chart');
  if (!chartEl) return;

  const usageData = getDailyUsage();
  const tenantUsage = (usageData.tenants && usageData.tenants[tenant.id]?.daily) || {};
  const dates = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
  const dailyValues = dates.map(d => tenantUsage[d] || Math.floor((tenant.monthlyUsage || 1000) / 30));

  chartEl.innerHTML = renderFancyLineGraph({
    dates, values: dailyValues, unit: 'calls',
    strokeColor: '#06B6D4', gradientColor: '#38BDF8', chartId: `consumer-${tenant.id}-traffic`
  });
}

function renderConsumerStaffTable() {
  const tbody = document.getElementById('consumer-staff-tbody');
  if (!tbody) return;

  const staffList = Array.isArray(tenant.staff) && tenant.staff.length > 0
    ? tenant.staff
    : [{ id: `staff_${tenant.id}_default`, name: 'Primary Developer Key', role: 'Lead Developer', email: `${tenant.id}@example.com`, apiKey: tenant.apiKey, monthlyUsage: tenant.monthlyUsage || 0 }];

  const totalCalls = tenant.monthlyUsage || 0;
  tbody.innerHTML = staffList.map(s => {
    const sRpm = getStaffRPM(tenant.id, s.id);
    const sCalls = s.monthlyUsage || 0;
    const share = totalCalls > 0 ? Math.round((sCalls / totalCalls) * 100) : 0;
    const masked = s.apiKey ? `sf_live_••••••••${s.apiKey.slice(-5)}` : 'No key';

    return `
      <tr>
        <td data-label="Staff Member"><strong>${s.name}</strong><div class="small text-muted">${s.email || ''}</div></td>
        <td data-label="Role / Team"><span class="badge bg-light text-dark border">${s.role || 'Engineer'}</span></td>
        <td data-label="Staff Sub-Key">
          <div class="d-flex align-items-center gap-1 font-monospace small">
            <span>${masked}</span>
            <button type="button" class="btn btn-sm btn-link p-0 text-primary btn-copy-cstaff-key" data-key="${s.apiKey}" title="Copy staff sub-key">${SVG_ICONS.copy}</button>
          </div>
        </td>
        <td data-label="Live RPM"><span class="rpm-badge ${sRpm > 0 ? 'rpm-badge-warning' : 'rpm-badge-normal'}">${sRpm} RPM</span></td>
        <td data-label="Monthly Calls" class="font-monospace fw-semibold">${sCalls.toLocaleString()}</td>
        <td data-label="Usage Share">
          <div class="d-flex align-items-center gap-2" style="min-width: 100px;">
            <div class="progress flex-grow-1" style="height:6px;"><div class="progress-bar bg-info" style="width:${share}%;"></div></div>
            <span class="small font-monospace text-muted">${share}%</span>
          </div>
        </td>
        <td data-label="Action"><button type="button" class="btn btn-sm btn-outline-secondary py-1 px-2 btn-copy-cstaff-key" data-key="${s.apiKey}">Copy Key</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-copy-cstaff-key').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-key');
      if (key) {
        navigator.clipboard.writeText(key)
          .then(() => showToast('Staff API key copied to clipboard!', 'success'))
          .catch(() => showToast(`Key: ${key}`, 'info'));
      }
    });
  });
}

function setupConsumerStaffModal() {
  const openBtn = document.getElementById('btn-open-consumer-add-staff');
  const modalEl = document.getElementById('modal-consumer-add-staff');
  const form = document.getElementById('form-consumer-add-staff');

  if (openBtn && modalEl && window.bootstrap) {
    const modal = new window.bootstrap.Modal(modalEl);
    openBtn.addEventListener('click', () => modal.show());

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('c-staff-name')?.value.trim();
      const role = document.getElementById('c-staff-role')?.value.trim() || 'Software Engineer';
      const email = document.getElementById('c-staff-email')?.value.trim();

      if (!name) { showToast('Staff member name is required.', 'warning'); return; }

      const added = addStaffMember(tenant.id, { name, role, email });
      modal.hide();
      form.reset();

      if (added) {
        tenant = getTenantById(tenant.id);
        renderConsumerData();
        showToast(`API Sub-key generated for ${added.name}!`, 'success');
      }
    });
  }
}

function setupCopyButton() {
  const copyBtn = document.getElementById('btn-copy-consumer-key');
  const toggleBtn = document.getElementById('btn-toggle-consumer-mask-key');
  const keyInput = document.getElementById('consumer-api-key');
  let isUnmasked = false;

  toggleBtn?.addEventListener('click', () => {
    if (!tenant?.apiKey) return;
    isUnmasked = !isUnmasked;
    if (isUnmasked) {
      keyInput.value = tenant.apiKey;
      toggleBtn.textContent = 'Hide';
      toggleBtn.title = 'Mask key';
    } else {
      keyInput.value = `sf_live_••••••••••••${tenant.apiKey.slice(-5)}`;
      toggleBtn.textContent = 'Show';
      toggleBtn.title = 'Show full key';
    }
  });

  copyBtn?.addEventListener('click', () => {
    if (tenant?.apiKey) {
      navigator.clipboard.writeText(tenant.apiKey)
        .then(() => showToast('API Key copied to clipboard!', 'success'))
        .catch(() => showToast(`API Key: ${tenant.apiKey}`, 'info'));
    }
  });
}
