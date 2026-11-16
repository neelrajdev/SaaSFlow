
import { initPage, showToast, updateBreadcrumbs, safeGoBack, showConfirmDialog } from '../app.js';
import { getTenantById, getPlanById, getPlans, getDailyUsage, getRequests, addStaffMember } from '../../../backend-simulation/storage.js';
import { applyPlanChange } from '../../../backend-simulation/billing.js';
import { getConsumerRPM, getStaffRPM } from '../../../backend-simulation/rateLimiter.js';
import { renderStatusBadge, renderPlanBadge, renderFancyLineGraph, SVG_ICONS } from '../components.js';

let currentTenant = null;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initPage({
    pageName: 'tenant-detail',
    title: 'Consumer Diagnostics & Plan Management',
    subtitle: 'Manage client tier limits, inspect masked credentials, and review historical usage'
  });
  if (!session) return;

  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('tenantId') || 'payeasy';

  currentTenant = getTenantById(tenantId);
  if (!currentTenant) {
    showToast(`Consumer "${tenantId}" not found.`, 'error');
    setTimeout(() => window.location.href = 'tenants.html', 1500);
    return;
  }

  renderTenantDetails();
  updateBreadcrumbs([
    { label: 'Overview', href: 'overview.html' },
    { label: 'Consumers', href: 'tenants.html' },
    { label: currentTenant.name, active: true }
  ]);

  document.querySelector('a[href="tenants.html"]')?.addEventListener('click', (e) => {
    e.preventDefault(); safeGoBack('tenants.html');
  });

  setupCopyKeyButton();
  setupPlanChangeButton();
  setupAddStaffModal();
});

function renderTenantDetails() {
  const plan = getPlanById(currentTenant.planId);
  const plans = getPlans();

  document.getElementById('detail-tenant-name').textContent = currentTenant.name;
  document.getElementById('detail-tenant-id').textContent = `ID: ${currentTenant.id}`;
  document.getElementById('detail-tenant-status').innerHTML = renderStatusBadge(currentTenant.status);
  document.getElementById('detail-plan-badge').innerHTML = `Current Tier: ${renderPlanBadge(currentTenant.planId)}`;

  const maskedKey = currentTenant.apiKey ? `sf_live_••••••••••••${currentTenant.apiKey.slice(-5)}` : 'No key generated';
  document.getElementById('detail-api-key-input').value = maskedKey;

  document.getElementById('detail-per-minute-limit').textContent = `${plan ? plan.perMinuteLimit : 5} req/min`;
  document.getElementById('detail-monthly-limit').textContent = `${plan ? plan.monthlyLimit.toLocaleString() : 10000} reqs`;

  const monthlyLimit = plan ? plan.monthlyLimit : 10000;
  const includedCalls = plan ? plan.includedCalls : 0;
  const actualCalls = currentTenant.monthlyUsage || 0;
  const overageCalls = Math.max(0, actualCalls - includedCalls);
  const pct = Math.min(100, Math.round((actualCalls / monthlyLimit) * 100));

  let colorClass = 'quota-normal';
  if (pct >= 90) colorClass = 'quota-critical';
  else if (pct >= 70) colorClass = 'quota-warning';

  document.getElementById('detail-quota-bar-container').innerHTML = `
    <div class="quota-container">
      <div class="quota-header">
        <span>Current Month (${currentTenant.billingMonth || '2026-10'})</span>
        <span class="fw-semibold">${pct}% used (${actualCalls.toLocaleString()} of ${monthlyLimit.toLocaleString()} calls)</span>
      </div>
      <div class="progress" style="height: 12px;">
        <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
    </div>
  `;

  document.getElementById('detail-included-calls').textContent = includedCalls.toLocaleString();
  document.getElementById('detail-actual-calls').textContent = actualCalls.toLocaleString();
  document.getElementById('detail-overage-calls').textContent = overageCalls.toLocaleString();

  const selectPlan = document.getElementById('select-new-plan');
  if (selectPlan) {
    selectPlan.innerHTML = plans.map(p => `<option value="${p.id}" ${p.id === currentTenant.planId ? 'selected' : ''}>${p.name} Tier (${p.perMinuteLimit} req/min, ${p.monthlyLimit.toLocaleString()} limit, ₹${(p.baseFeePaise/100).toLocaleString()}/mo)</option>`).join('');
  }

  renderLiveRPM(plan);
  renderStaffTable();
  render7DayChart();
  renderTenantLogs();
}

function renderLiveRPM(plan) {
  const perMinute = plan ? plan.perMinuteLimit : 20;
  const rpm = getConsumerRPM(currentTenant.id, perMinute);
  const badgeEl = document.getElementById('detail-rpm-badge');
  const barEl = document.getElementById('detail-rpm-progress-bar');
  const textEl = document.getElementById('detail-rpm-window-text');

  if (badgeEl) {
    const badgeClass = rpm.status === 'throttled' ? 'rpm-badge-danger' : (rpm.status === 'critical' ? 'rpm-badge-warning' : 'rpm-badge-normal');
    badgeEl.className = `rpm-badge ${badgeClass}`;
    badgeEl.textContent = `${rpm.currentRpm} / ${rpm.limit} RPM`;
  }

  if (barEl) {
    barEl.style.width = `${rpm.utilizationPercent}%`;
    barEl.setAttribute('aria-valuenow', rpm.utilizationPercent);
    barEl.className = `progress-bar ${rpm.status === 'throttled' ? 'bg-danger' : (rpm.status === 'critical' ? 'bg-warning' : 'bg-primary')}`;
  }

  if (textEl) {
    textEl.textContent = rpm.isThrottled
      ? `Throttled! Window resets in ${rpm.resetInSeconds}s`
      : `Window resets in ${rpm.resetInSeconds}s (${rpm.remainingRpm} RPM remaining)`;
  }
}

function renderStaffTable() {
  const tbody = document.getElementById('detail-staff-tbody');
  if (!tbody) return;

  const staffList = Array.isArray(currentTenant.staff) && currentTenant.staff.length > 0
    ? currentTenant.staff
    : [{ id: `staff_${currentTenant.id}_default`, name: 'Primary Admin Key', role: 'Account Owner', email: `${currentTenant.id}@example.io`, apiKey: currentTenant.apiKey, monthlyUsage: currentTenant.monthlyUsage || 0 }];

  const totalCalls = currentTenant.monthlyUsage || 0;
  tbody.innerHTML = staffList.map(s => {
    const sRpm = getStaffRPM(currentTenant.id, s.id);
    const sCalls = s.monthlyUsage || 0;
    const share = totalCalls > 0 ? Math.round((sCalls / totalCalls) * 100) : 0;
    const masked = s.apiKey ? `sf_live_••••••••${s.apiKey.slice(-5)}` : 'No key';

    return `
      <tr>
        <td data-label="Staff Member"><strong>${s.name}</strong><div class="small text-muted">${s.email || ''}</div></td>
        <td data-label="Role / Department"><span class="badge bg-light text-dark border">${s.role || 'Engineer'}</span></td>
        <td data-label="Staff API Key (Sub-Key)">
          <div class="d-flex align-items-center gap-1 font-monospace small">
            <span>${masked}</span>
            <button type="button" class="btn btn-sm btn-link p-0 text-primary btn-copy-staff-key" data-key="${s.apiKey}" title="Copy sub-key">${SVG_ICONS.copy}</button>
          </div>
        </td>
        <td data-label="Live Rate (RPM)"><span class="rpm-badge ${sRpm > 0 ? 'rpm-badge-warning' : 'rpm-badge-normal'}">${sRpm} RPM</span></td>
        <td data-label="Monthly Calls" class="font-monospace fw-semibold">${sCalls.toLocaleString()}</td>
        <td data-label="Volume Share">
          <div class="d-flex align-items-center gap-2" style="min-width: 110px;">
            <div class="progress flex-grow-1" style="height:6px;"><div class="progress-bar bg-info" style="width:${share}%;"></div></div>
            <span class="small font-monospace text-muted">${share}%</span>
          </div>
        </td>
        <td data-label="Action"><button type="button" class="btn btn-sm btn-outline-secondary py-1 px-2 btn-copy-staff-key" data-key="${s.apiKey}">Copy Key</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-copy-staff-key').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-key');
      if (key) {
        navigator.clipboard.writeText(key)
          .then(() => showToast('Staff key copied to clipboard!', 'success'))
          .catch(() => showToast(`Key: ${key}`, 'info'));
      }
    });
  });
}

function setupAddStaffModal() {
  const openBtn = document.getElementById('btn-open-add-staff');
  const modalEl = document.getElementById('modal-add-staff-member');
  const form = document.getElementById('form-add-staff-member');

  if (openBtn && modalEl && window.bootstrap) {
    const modal = new window.bootstrap.Modal(modalEl);
    openBtn.addEventListener('click', () => modal.show());

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-staff-name')?.value.trim();
      const role = document.getElementById('new-staff-role')?.value.trim() || 'Integration Engineer';
      const email = document.getElementById('new-staff-email')?.value.trim();

      if (!name) { showToast('Staff member name is required.', 'warning'); return; }

      const added = addStaffMember(currentTenant.id, { name, role, email });
      modal.hide();
      form.reset();

      if (added) {
        currentTenant = getTenantById(currentTenant.id);
        renderStaffTable();
        showToast(`Staff API key created for ${added.name}!`, 'success');
      }
    });
  }
}

function render7DayChart() {
  const chartEl = document.getElementById('detail-usage-chart');
  if (!chartEl) return;

  const usageData = getDailyUsage();
  const tenantUsage = (usageData.tenants && usageData.tenants[currentTenant.id]?.daily) || {};
  const dates = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
  const dailyValues = dates.map(d => tenantUsage[d] || Math.floor((currentTenant.monthlyUsage || 1000) / 30));

  chartEl.innerHTML = renderFancyLineGraph({
    dates, values: dailyValues, unit: 'calls',
    strokeColor: '#FF7A59', gradientColor: '#8B5CF6', chartId: `tenant-${currentTenant.id}-curve`
  });
}

function renderTenantLogs() {
  const tbody = document.getElementById('detail-requests-tbody');
  if (!tbody) return;

  const tenantRequests = getRequests().filter(r => r.tenantId === currentTenant.id);
  if (tenantRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3 small">No live requests recorded for ${currentTenant.name} in this session.</td></tr>`;
    return;
  }

  tbody.innerHTML = tenantRequests.slice(0, 8).map(r => {
    const badge = r.httpStatus === 200 ? '<span class="badge bg-success">200 OK</span>' : (r.httpStatus === 401 ? '<span class="badge bg-danger">401 Unauthorized</span>' : '<span class="badge bg-warning text-dark">429 Throttled</span>');
    return `
      <tr>
        <td class="font-monospace small">${r.id}</td>
        <td class="font-monospace text-primary small">${r.endpoint}</td>
        <td>${badge}</td>
        <td class="font-monospace small text-muted">${r.responseTime}ms</td>
        <td class="small text-secondary">${new Date(r.timestamp).toLocaleTimeString()}</td>
      </tr>
    `;
  }).join('');
}

function setupCopyKeyButton() {
  const copyBtn = document.getElementById('btn-copy-api-key');
  const toggleBtn = document.getElementById('btn-toggle-mask-key');
  const inputEl = document.getElementById('detail-api-key-input');
  let isUnmasked = false;

  toggleBtn?.addEventListener('click', () => {
    if (!currentTenant?.apiKey) return;
    isUnmasked = !isUnmasked;
    if (isUnmasked) {
      inputEl.value = currentTenant.apiKey;
      toggleBtn.textContent = 'Hide';
      toggleBtn.title = 'Mask key';
    } else {
      inputEl.value = `sf_live_••••••••••••${currentTenant.apiKey.slice(-5)}`;
      toggleBtn.textContent = 'Show';
      toggleBtn.title = 'Show full key';
    }
  });

  copyBtn?.addEventListener('click', () => {
    if (currentTenant?.apiKey) {
      navigator.clipboard.writeText(currentTenant.apiKey)
        .then(() => showToast('Full API Key copied to clipboard!', 'success'))
        .catch(() => showToast(`API Key: ${currentTenant.apiKey}`, 'info'));
    }
  });
}

function setupPlanChangeButton() {
  const updateBtn = document.getElementById('btn-update-plan');
  const selectPlan = document.getElementById('select-new-plan');
  if (!updateBtn || !selectPlan) return;

  updateBtn.addEventListener('click', async () => {
    const newPlanId = selectPlan.value;
    if (newPlanId === currentTenant.planId) {
      showToast(`${currentTenant.name} is already on the ${newPlanId.toUpperCase()} tier.`, 'warning');
      return;
    }

    const confirmed = await showConfirmDialog({
      title: 'Change Subscription Tier?',
      message: `Change ${currentTenant.name}'s plan from ${currentTenant.planId.toUpperCase()} to ${newPlanId.toUpperCase()} tier?`,
      confirmText: 'Change Plan',
      confirmVariant: 'primary',
      icon: SVG_ICONS.plans
    });
    if (!confirmed) return;

    const res = applyPlanChange(currentTenant.id, newPlanId);
    if (res.success) {
      currentTenant = getTenantById(currentTenant.id);
      renderTenantDetails();
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  });
}
