
import { initPage, showToast } from '../app.js';
import { getTenants, getPlans, createConsumer } from '../../../backend-simulation/storage.js';
import { getConsumerRPM } from '../../../backend-simulation/rateLimiter.js';
import { renderPlanBadge, renderStatusBadge, renderQuotaBar, renderEmptyState } from '../components.js';

let allTenants = [], allPlans = [];

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initPage({
    pageName: 'tenants',
    title: 'Consumers Management',
    subtitle: 'Inspect client consumer subscriptions, API quotas, and consumption thresholds'
  });
  if (!session) return;

  allTenants = getTenants();
  allPlans = getPlans();
  renderTenantsList(allTenants);
  setupFilterListeners();
  setupCreateConsumerModal();
});

function renderTenantsList(tenants) {
  const tbody = document.getElementById('tenants-table-body');
  const countEl = document.getElementById('tenants-count');
  const emptyContainer = document.getElementById('tenants-empty-state');
  if (!tbody) return;

  if (countEl) countEl.textContent = tenants.length;

  if (tenants.length === 0) {
    tbody.innerHTML = '';
    if (emptyContainer) {
      emptyContainer.classList.remove('d-none');
      emptyContainer.innerHTML = renderEmptyState({
        icon: '🔍', title: 'No matching consumers found',
        message: 'No client consumers match your active search and filter criteria.',
        actionLabel: 'Reset Filters', actionId: 'btn-reset-empty-filters'
      });
      document.getElementById('btn-reset-empty-filters')?.addEventListener('click', resetAllFilters);
    }
    return;
  }

  emptyContainer?.classList.add('d-none');
  tbody.innerHTML = tenants.map(t => {
    const plan = allPlans.find(p => p.id === t.planId);
    const limit = plan ? plan.monthlyLimit : 10000;
    const perMinute = plan ? plan.perMinuteLimit : 20;
    const usage = t.monthlyUsage || 0;
    const pct = Math.min(100, Math.round((usage / limit) * 100));
    const staffCount = (Array.isArray(t.staff) && t.staff.length) || 1;
    const rpm = getConsumerRPM(t.id, perMinute);
    const rpmClass = rpm.status === 'throttled' ? 'rpm-badge-danger' : (rpm.status === 'critical' ? 'rpm-badge-warning' : 'rpm-badge-normal');

    return `
      <tr>
        <td data-label="Consumer Name"><strong>${t.name}</strong></td>
        <td data-label="Consumer ID" class="font-monospace small text-muted">${t.id}</td>
        <td data-label="Plan Tier">${renderPlanBadge(t.planId)}</td>
        <td data-label="Staff & Live RPM">
          <div class="d-flex align-items-center gap-1 flex-wrap">
            <span class="badge bg-light text-dark border">${staffCount} staff</span>
            <span class="rpm-badge ${rpmClass}" title="Calls in rolling 60s / limit">${rpm.currentRpm}/${rpm.limit} RPM</span>
          </div>
        </td>
        <td data-label="Monthly Usage" class="font-monospace fw-semibold">${usage.toLocaleString()}</td>
        <td data-label="Monthly Limit" class="font-monospace text-muted">${limit.toLocaleString()}</td>
        <td data-label="Quota Utilization" style="min-width:180px;">${renderQuotaBar({ used: usage, total: limit, showDetails: false })}<span class="small text-secondary fw-semibold">${pct}% used</span></td>
        <td data-label="Status">${renderStatusBadge(t.status)}</td>
        <td data-label="Action"><a href="tenant-detail.html?tenantId=${t.id}" class="btn btn-sm btn-outline-primary py-1 px-2">View Details</a></td>
      </tr>
    `;
  }).join('');
}

function setupCreateConsumerModal() {
  const openBtn = document.getElementById('btn-open-create-consumer');
  const planSelect = document.getElementById('new-consumer-plan');
  const form = document.getElementById('form-create-consumer');
  const modalEl = document.getElementById('modal-create-consumer');

  const populatePlans = () => {
    allPlans = getPlans();
    if (planSelect) {
      planSelect.innerHTML = allPlans.map(p => `<option value="${p.id}">${p.name} Plan — ${p.perMinuteLimit} RPM, ${p.monthlyLimit.toLocaleString()} calls${p.isCustom ? ' (Custom Tier)' : ''}</option>`).join('');
    }
  };
  populatePlans();

  if (openBtn && modalEl && window.bootstrap) {
    const modal = new window.bootstrap.Modal(modalEl);
    openBtn.addEventListener('click', () => { populatePlans(); modal.show(); });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-consumer-name')?.value.trim();
      const industry = document.getElementById('new-consumer-industry')?.value || 'Technology';
      const contactName = document.getElementById('new-consumer-contact-name')?.value.trim() || 'Admin';
      const contactEmail = document.getElementById('new-consumer-contact-email')?.value.trim();
      const planId = planSelect?.value || 'starter';

      if (!name) { showToast('Please provide company name.', 'warning'); return; }

      const created = createConsumer({ name, planId, contactName, contactEmail, industry });
      modal.hide();
      form.reset();
      showToast(`Consumer "${created.name}" registered successfully!`, 'success');
      allTenants = getTenants();
      renderTenantsList(allTenants);
    });
  }
}

function setupFilterListeners() {
  const searchInput = document.getElementById('tenant-search-input');
  const planSelect = document.getElementById('filter-plan-select');
  const statusSelect = document.getElementById('filter-status-select');

  const apply = () => {
    const q = searchInput?.value.toLowerCase().trim() || '';
    const sp = planSelect?.value || 'all';
    const ss = statusSelect?.value || 'all';

    const filtered = allTenants.filter(t => {
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
      const matchP = sp === 'all' || t.planId.toLowerCase() === sp;
      const matchS = ss === 'all' || t.status.toLowerCase() === ss;
      return matchQ && matchP && matchS;
    });
    renderTenantsList(filtered);
  };

  searchInput?.addEventListener('input', apply);
  planSelect?.addEventListener('change', apply);
  statusSelect?.addEventListener('change', apply);
  document.getElementById('btn-clear-filters')?.addEventListener('click', resetAllFilters);
}

function resetAllFilters() {
  const s = document.getElementById('tenant-search-input'); if (s) s.value = '';
  const p = document.getElementById('filter-plan-select'); if (p) p.value = 'all';
  const st = document.getElementById('filter-status-select'); if (st) st.value = 'all';
  renderTenantsList(allTenants);
}
