
import { initStorage, getTenants, resetAllData } from '../../../backend-simulation/storage.js';
import { login } from '../../../backend-simulation/auth.js';
import { renderToast, showConfirmDialog, SVG_ICONS } from '../components.js';

let selectedRole = 'founder';

document.addEventListener('DOMContentLoaded', async () => {
  await initStorage();
  populateTenantDropdown();
  setupRoleCardListeners();
  setupEnterButton();
  setupResetButton();
});

function populateTenantDropdown() {
  const select = document.getElementById('select-tenant');
  if (!select) return;
  const tenants = getTenants();
  if (tenants.length > 0) {
    select.innerHTML = tenants.map(t => {
      const isBenchmark = t.id === 'payeasy' ? ' — PRD Benchmark' : '';
      const statusNote = t.status === 'suspended' ? ' [Suspended]' : '';
      return `<option value="${t.id}">${t.name} (${t.planId.toUpperCase()} Plan — ${t.monthlyUsage.toLocaleString()} calls${isBenchmark})${statusNote}</option>`;
    }).join('');
  }
}

function setupRoleCardListeners() {
  const cards = document.querySelectorAll('.role-select-card');
  const tenantGroup = document.getElementById('consumer-tenant-selector-group');

  cards.forEach(card => {
    const select = () => {
      cards.forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      selectedRole = card.getAttribute('data-role');
      if (selectedRole === 'consumer') tenantGroup?.classList.remove('d-none');
      else tenantGroup?.classList.add('d-none');
    };
    card.addEventListener('click', select);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
  });
}

function setupEnterButton() {
  document.getElementById('btn-enter-dashboard')?.addEventListener('click', () => {
    const tenantId = selectedRole === 'consumer' ? (document.getElementById('select-tenant')?.value || 'shopkart') : null;
    const res = login(selectedRole, tenantId);
    if (!res.success) { renderToast({ message: res.error, type: 'error' }); return; }

    renderToast({ message: `Logged in as ${selectedRole.toUpperCase()}`, type: 'success' });
    setTimeout(() => {
      const routes = { founder: 'pages/overview.html', consumer: 'pages/my-api.html', finance: 'pages/billing.html' };
      window.location.href = routes[selectedRole] || 'pages/overview.html';
    }, 400);
  });
}

function setupResetButton() {
  const resetBtn = document.getElementById('btn-reset-data');
  if (!resetBtn) return;

  resetBtn.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog({
      title: 'Reset Demo Data?',
      message: 'This will restore original consumer plans, quotas, and seed invoices. Are you sure you want to proceed?',
      confirmText: 'Reset Demo Data',
      confirmVariant: 'danger',
      icon: SVG_ICONS.alert
    });
    if (!confirmed) return;

    resetBtn.disabled = true;
    resetBtn.innerText = 'Resetting...';
    await resetAllData();
    populateTenantDropdown();
    renderToast({ message: 'Demo data has been successfully reset to initial seeds!', type: 'success' });
    resetBtn.disabled = false;
    resetBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Reset Demo Data';
  });
}
