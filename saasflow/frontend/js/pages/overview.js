
import { initPage, showToast } from '../app.js';
import { getTenants, getPlans, getRequests, getDailyUsage } from '../../../backend-simulation/storage.js';
import { calcMRR } from '../../../backend-simulation/state.js';
import { rupees } from '../../../backend-simulation/billing.js';
import { renderPlanBadge, renderStatusBadge, renderQuotaBar, renderWelcomeGuide, setupWelcomeGuide, renderFancyLineGraph } from '../components.js';
import { handleRequest } from '../../../backend-simulation/gateway.js';
import { getConsumerRPM } from '../../../backend-simulation/rateLimiter.js';

let autoTrafficTimer = null;
const AUTO_TRAFFIC_ENDPOINTS = ['/api/v1/weather', '/api/v1/stock', '/api/v1/users', '/api/v1/analytics', '/api/v1/payments'];

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initPage({
    pageName: 'overview',
    title: 'Founder Overview',
    subtitle: 'System traffic health, consumer quota utilization, and revenue metrics'
  });
  if (!session) return;

  const guideSlot = document.getElementById('welcome-guide-slot');
  if (guideSlot) { guideSlot.innerHTML = renderWelcomeGuide(); setupWelcomeGuide(); }

  renderDashboardData();
  setupTrafficSimulator();

  window.addEventListener('beforeunload', () => { if (autoTrafficTimer) clearInterval(autoTrafficTimer); });
});

function renderDashboardData() {
  const tenants = getTenants();
  const plans = getPlans();
  const requests = getRequests();

  let totalCalls = tenants.reduce((s, t) => s + (t.monthlyUsage || 0), 0);
  let successCalls = 0, blockedCalls = 0;
  requests.forEach(r => {
    if (r.httpStatus === 200) successCalls++;
    else if (r.httpStatus === 401 || r.httpStatus === 429) blockedCalls++;
  });

  if (requests.length === 0) {
    successCalls = Math.round(totalCalls * 0.967);
    blockedCalls = totalCalls - successCalls;
  }

  document.getElementById('kpi-total-calls') && (document.getElementById('kpi-total-calls').textContent = totalCalls.toLocaleString());
  document.getElementById('kpi-success-calls') && (document.getElementById('kpi-success-calls').textContent = successCalls.toLocaleString());
  document.getElementById('kpi-blocked-calls') && (document.getElementById('kpi-blocked-calls').textContent = blockedCalls.toLocaleString());
  document.getElementById('kpi-mrr') && (document.getElementById('kpi-mrr').textContent = rupees(calcMRR()));

  checkQuotaAlertBanner(tenants, plans);
  renderPlatformTrafficChart();
  renderTopTenantsTable(tenants, plans);
  renderRecentActivityTable(requests);
}

function renderPlatformTrafficChart() {
  const chartEl = document.getElementById('overview-traffic-chart');
  if (!chartEl) return;

  const usageData = getDailyUsage();
  const tenantsDaily = (usageData && usageData.tenants) || {};
  const dates = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];

  const aggregateDaily = dates.map(date => {
    let sum = 0;
    Object.values(tenantsDaily).forEach(t => { if (t?.daily?.[date]) sum += t.daily[date]; });
    return sum > 0 ? sum : 21450 + Math.floor(Math.random() * 4000);
  });

  chartEl.innerHTML = renderFancyLineGraph({
    dates, values: aggregateDaily, unit: 'requests',
    strokeColor: '#FF7A59', gradientColor: '#FF8A65', chartId: 'overview-platform-traffic'
  });
}

function checkQuotaAlertBanner(tenants, plans) {
  const alertContainer = document.getElementById('quota-alert-container');
  const alertText = document.getElementById('quota-alert-text');
  if (!alertContainer || !alertText) return;

  const critical = [];
  tenants.forEach(t => {
    const plan = plans.find(p => p.id === t.planId);
    const limit = plan ? plan.monthlyLimit : 10000;
    const usage = t.monthlyUsage || 0;
    if ((usage / limit) >= 0.90) critical.push(`${t.name} (${Math.round((usage / limit) * 100)}%)`);
  });

  if (critical.length > 0) {
    alertContainer.classList.remove('d-none');
    alertText.innerHTML = `<strong>Attention:</strong> ${critical.join(', ')} reached or exceeded 90% of their monthly quota.`;
  } else {
    alertContainer.classList.add('d-none');
  }
}

function renderTopTenantsTable(tenants, plans) {
  const tbody = document.getElementById('top-tenants-table-body');
  if (!tbody) return;

  const sorted = [...tenants].sort((a, b) => (b.monthlyUsage || 0) - (a.monthlyUsage || 0));
  tbody.innerHTML = sorted.slice(0, 5).map(t => {
    const plan = plans.find(p => p.id === t.planId);
    const limit = plan ? plan.monthlyLimit : 10000;
    const usage = t.monthlyUsage || 0;
    const pct = Math.min(100, Math.round((usage / limit) * 100));
    const overageNote = (plan && usage > plan.includedCalls)
      ? `<span class="badge bg-warning-subtle text-warning ms-1">+${(usage - plan.includedCalls).toLocaleString()} overage</span>` : '';

    const rpm = getConsumerRPM(t.id, plan ? plan.perMinuteLimit : 20);
    const rpmClass = rpm.status === 'throttled' ? 'rpm-badge-danger' : (rpm.status === 'critical' ? 'rpm-badge-warning' : 'rpm-badge-normal');

    return `
      <tr>
        <td data-label="Consumer Name"><strong>${t.name}</strong><div class="small text-muted font-monospace">${t.id}</div></td>
        <td data-label="Plan Tier">${renderPlanBadge(t.planId)}<span class="rpm-badge ${rpmClass} d-block mt-1" style="font-size:0.7rem;">${rpm.currentRpm}/${rpm.limit} RPM</span></td>
        <td data-label="Monthly Calls"><strong>${usage.toLocaleString()}</strong> / ${limit.toLocaleString()}${overageNote}</td>
        <td data-label="Quota Utilization" style="min-width:170px;">${renderQuotaBar({ used: usage, total: limit, showDetails: false })}<span class="small text-secondary fw-semibold">${pct}% used</span></td>
        <td data-label="Status">${renderStatusBadge(t.status)}</td>
        <td data-label="Action"><a href="tenant-detail.html?tenantId=${t.id}" class="btn btn-sm btn-outline-primary py-1 px-2">Details</a></td>
      </tr>
    `;
  }).join('');
}

function renderRecentActivityTable(requests) {
  const tbody = document.getElementById('recent-requests-table-body');
  if (!tbody) return;

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3 small">No live API requests recorded yet. Enable the Traffic Simulator above or test in the Playground!</td></tr>`;
    return;
  }

  tbody.innerHTML = requests.slice(0, 8).map(r => {
    const statusBadge = r.httpStatus === 200 ? '<span class="badge bg-success">200 OK</span>' : (r.httpStatus === 401 ? '<span class="badge bg-danger">401 Unauthorized</span>' : '<span class="badge bg-warning text-dark">429 Throttled</span>');
    const staffLabel = r.staffName ? `<span class="small text-muted font-monospace d-block">👤 ${r.staffName}</span>` : '';
    return `
      <tr>
        <td class="font-monospace small">${r.id}</td>
        <td><strong>${r.tenantId}</strong>${staffLabel}</td>
        <td class="font-monospace text-primary small">${r.endpoint}</td>
        <td>${statusBadge}</td>
        <td class="font-monospace small text-muted">${r.responseTime}ms</td>
        <td class="small text-secondary">${formatTimeAgo(r.timestamp)}</td>
      </tr>
    `;
  }).join('');
}

function setupTrafficSimulator() {
  const toggle = document.getElementById('toggle-traffic-simulation');
  const label = document.getElementById('traffic-simulation-label');
  const liveDot = document.getElementById('live-traffic-dot');
  if (!toggle) return;

  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      if (label) label.textContent = 'Traffic Simulation: ON (2s interval)';
      liveDot?.classList.remove('d-none');
      showToast('Live traffic simulation started', 'info');
      autoTrafficTimer = setInterval(async () => {
        const active = getTenants().filter(t => t.status === 'active');
        if (active.length === 0) return;
        const tenant = active[Math.floor(Math.random() * active.length)];
        const endpoint = AUTO_TRAFFIC_ENDPOINTS[Math.floor(Math.random() * AUTO_TRAFFIC_ENDPOINTS.length)];
        await handleRequest(tenant.apiKey, endpoint, Date.now(), { skipDelay: true });
        renderDashboardData();
      }, 2000);
    } else {
      if (label) label.textContent = 'Traffic Simulation: OFF';
      liveDot?.classList.add('d-none');
      if (autoTrafficTimer) { clearInterval(autoTrafficTimer); autoTrafficTimer = null; }
      showToast('Traffic simulation stopped', 'info');
    }
  });
}

function formatTimeAgo(timestamp) {
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}
