
import { initPage, showToast } from '../app.js';
import { handleRequest } from '../../../backend-simulation/gateway.js';
import { getCurrentTenant } from '../../../backend-simulation/state.js';
import { getTenants } from '../../../backend-simulation/storage.js';
import { getStaffRPM, getConsumerRPM } from '../../../backend-simulation/rateLimiter.js';
import { renderResponsePanel } from '../components.js';

let activeCountdownInterval = null;
const sessionHistory = [];
let activeStaffSender = null;
let activeConsumerId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initPage({
    pageName: 'playground',
    title: 'API Testing Playground',
    subtitle: 'Test simulated API responses, trigger rate limits, and observe Gateway response codes'
  });
  if (!session) return;

  setupInitialCredentials(session);
  setupFormSubmission();
  setupRapidTestButtons();
  setupStaffSelector(session);

  window.addEventListener('beforeunload', () => { if (activeCountdownInterval) clearInterval(activeCountdownInterval); });
});

function setupStaffSelector(session) {
  const staffSelect = document.getElementById('select-staff-sender');
  const apiKeyInput = document.getElementById('input-api-key');
  if (!staffSelect || !apiKeyInput) return;

  let candidates = [];
  if (session?.role === 'consumer') {
    const tenant = getCurrentTenant();
    if (tenant) {
      activeConsumerId = tenant.id;
      candidates = (Array.isArray(tenant.staff) && tenant.staff.length > 0)
        ? tenant.staff.map(s => ({ ...s, consumerName: tenant.name, consumerId: tenant.id }))
        : [{ id: 'master', name: tenant.name, role: 'Master Key', apiKey: tenant.apiKey, consumerName: tenant.name, consumerId: tenant.id }];
    }
  } else {
    getTenants().forEach(t => {
      if (Array.isArray(t.staff) && t.staff.length > 0) {
        t.staff.forEach(s => candidates.push({ ...s, consumerName: t.name, consumerId: t.id }));
      } else {
        candidates.push({ id: 'master', name: t.name, role: 'Master Key', apiKey: t.apiKey, consumerName: t.name, consumerId: t.id });
      }
    });
  }

  staffSelect.innerHTML = candidates.map((c, i) => `<option value="${c.apiKey}" data-staff-id="${c.id}" data-consumer-id="${c.consumerId}" ${i === 0 ? 'selected' : ''}>${c.name} (${c.role}) — ${c.consumerName}</option>`).join('');

  const updateActiveStaff = () => {
    const opt = staffSelect.options[staffSelect.selectedIndex];
    if (opt) {
      apiKeyInput.value = opt.value;
      activeStaffSender = opt.getAttribute('data-staff-id');
      activeConsumerId = opt.getAttribute('data-consumer-id');
      updateStaffRpmBadge();
    }
  };

  staffSelect.addEventListener('change', updateActiveStaff);
  updateActiveStaff();
}

export function updateStaffRpmBadge() {
  const rpmBadge = document.getElementById('playground-staff-rpm-badge');
  if (!rpmBadge || !activeConsumerId) return;

  const staffRpm = activeStaffSender ? getStaffRPM(activeConsumerId, activeStaffSender) : 0;
  const consumerRpm = getConsumerRPM(activeConsumerId, 20);
  rpmBadge.className = `rpm-badge ${staffRpm > 0 ? 'rpm-badge-warning' : 'rpm-badge-normal'}`;
  rpmBadge.textContent = `Staff: ${staffRpm} RPM | Co: ${consumerRpm.currentRpm} RPM`;
}

function setupInitialCredentials(session) {
  const apiKeyInput = document.getElementById('input-api-key');
  if (!apiKeyInput) return;

  if (session.role === 'consumer') {
    const tenant = getCurrentTenant();
    if (tenant?.apiKey) apiKeyInput.value = tenant.apiKey;
  } else {
    const tenants = getTenants();
    const def = tenants.find(t => t.id === 'weathernow') || tenants[0];
    if (def) apiKeyInput.value = def.apiKey;
  }
}

function setupFormSubmission() {
  const sendBtn = document.getElementById('btn-send-request');
  const endpointInput = document.getElementById('input-endpoint');
  const selectMethod = document.getElementById('select-method');
  const postBodyContainer = document.getElementById('post-body-container');

  sendBtn?.addEventListener('click', () => executeGatewayCall());
  endpointInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); executeGatewayCall(); } });

  selectMethod?.addEventListener('change', () => {
    if (selectMethod.value === 'POST') postBodyContainer?.classList.remove('d-none');
    else postBodyContainer?.classList.add('d-none');
  });

  document.getElementById('btn-clear-history')?.addEventListener('click', () => {
    sessionHistory.length = 0;
    renderHistoryTable();
    showToast('Session history cleared', 'info');
  });
}

async function executeGatewayCall() {
  const apiKey = document.getElementById('input-api-key')?.value.trim() || '';
  const endpoint = document.getElementById('input-endpoint')?.value.trim() || '/api/v1/weather';
  const sendBtn = document.getElementById('btn-send-request');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnText = document.getElementById('btn-send-text');
  const responseContainer = document.getElementById('playground-response-container');
  const statusSummary = document.getElementById('response-status-summary');

  if (sendBtn) sendBtn.disabled = true;
  btnSpinner?.classList.remove('d-none');
  if (btnText) btnText.textContent = 'Processing...';

  try {
    const now = Date.now();
    const result = await handleRequest(apiKey, endpoint, now);
    updateStaffRpmBadge();

    if (responseContainer) {
      responseContainer.innerHTML = renderResponsePanel({
        status: result.httpStatus,
        body: result.body,
        responseTime: result.responseTime,
        retryAfter: result.rateLimitInfo ? result.rateLimitInfo.retryAfter : 0,
        quotaExhausted: result.body?.quotaExhausted
      });
      document.getElementById('btn-copy-response')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(result.body, null, 2)).then(() => showToast('Response JSON copied!', 'success'));
      });
    }

    if (statusSummary) statusSummary.textContent = `${result.httpStatus} • ${result.responseTime}ms`;

    sessionHistory.unshift({ status: result.httpStatus, endpoint, time: new Date(now).toLocaleTimeString() });
    renderHistoryTable();

    if (result.httpStatus === 429 && result.rateLimitInfo?.retryAfter > 0) {
      startCountdownTimer(result.rateLimitInfo.retryAfter);
    } else {
      if (sendBtn) sendBtn.disabled = false;
      btnSpinner?.classList.add('d-none');
      if (btnText) btnText.textContent = 'Send Request';
    }
  } catch (err) {
    console.error('[Playground] Error:', err);
    showToast('Failed to process simulated request', 'error');
    if (sendBtn) sendBtn.disabled = false;
    btnSpinner?.classList.add('d-none');
    if (btnText) btnText.textContent = 'Send Request';
  }
}

function startCountdownTimer(initialSeconds) {
  if (activeCountdownInterval) clearInterval(activeCountdownInterval);
  let remaining = initialSeconds;

  const sendBtn = document.getElementById('btn-send-request');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnText = document.getElementById('btn-send-text');
  const display = document.getElementById('countdown-timer-display');
  const countdownBox = document.getElementById('retry-countdown-container');

  if (sendBtn) sendBtn.disabled = true;
  btnSpinner?.classList.add('d-none');
  if (btnText) btnText.textContent = `Throttled (${remaining}s)`;
  announceToScreenReader(`Rate limit reached. Retrying allowed in ${remaining} seconds.`);

  activeCountdownInterval = setInterval(() => {
    remaining -= 1;
    if (display) display.textContent = `${remaining}s`;
    if (btnText) btnText.textContent = `Throttled (${remaining}s)`;

    if (remaining <= 0) {
      clearInterval(activeCountdownInterval);
      activeCountdownInterval = null;
      if (sendBtn) sendBtn.disabled = false;
      if (btnText) btnText.textContent = 'Send Request';
      countdownBox?.classList.add('d-none');
      announceToScreenReader('Rate limit window has reset. You may send requests again.');
      showToast('Rate limit window reset. Ready to send again!', 'success');
    }
  }, 1000);
}

function announceToScreenReader(text) {
  let announcer = document.getElementById('sr-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'sr-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.className = 'visually-hidden';
    document.body.appendChild(announcer);
  }
  announcer.textContent = text;
}

function setupRapidTestButtons() {
  const invalidKeyBtn = document.getElementById('btn-use-invalid-key');
  const rapidBtn = document.getElementById('btn-rapid-requests');
  const apiKeyInput = document.getElementById('input-api-key');

  invalidKeyBtn?.addEventListener('click', () => {
    if (apiKeyInput) apiKeyInput.value = 'sf_live_invalid_bad_key_00000';
    showToast('Set to invalid key. Click "Send Request" to test 401.', 'warning');
  });

  rapidBtn?.addEventListener('click', async () => {
    rapidBtn.disabled = true;
    rapidBtn.textContent = 'Sending 5 calls...';
    showToast('Triggering 5 rapid requests...', 'info');

    for (let i = 1; i <= 5; i++) {
      await executeGatewayCall();
      await new Promise(r => setTimeout(r, 100));
    }
    rapidBtn.disabled = false;
    rapidBtn.textContent = 'Trigger 5 Rapid Calls';
  });
}

function renderHistoryTable() {
  const tbody = document.getElementById('playground-history-tbody');
  if (!tbody) return;

  if (sessionHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted small py-3">No requests sent yet in this session.</td></tr>`;
    return;
  }

  tbody.innerHTML = sessionHistory.slice(0, 10).map(i => {
    const badgeClass = i.status === 401 ? 'bg-danger' : (i.status === 429 ? 'bg-warning text-dark' : 'bg-success');
    return `<tr><td><span class="badge ${badgeClass}">${i.status}</span></td><td class="font-monospace small text-primary">${i.endpoint}</td><td class="font-monospace small text-muted">${i.time}</td></tr>`;
  }).join('');
}
