
import { initPage, showToast, showConfirmDialog } from '../app.js';
import { getPlans, createCustomPlan, deletePlan } from '../../../backend-simulation/storage.js';
import { getCurrentTenant } from '../../../backend-simulation/state.js';
import { applyPlanChange } from '../../../backend-simulation/billing.js';
import { renderPlanBadge, SVG_ICONS } from '../components.js';

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initPage({
    pageName: 'plans',
    title: 'Subscription Tiers & Rate Limits',
    subtitle: 'Transparent pricing, fixed-window per-minute limits, and metered overage rates'
  });
  if (!session) return;

  renderDynamicPlans(session);
  setupCustomPlanModal(session);
});

function renderDynamicPlans(session) {
  const plans = getPlans();
  const currentTenant = session?.role === 'consumer' ? getCurrentTenant() : null;
  const currentPlanId = currentTenant?.planId;

  const founderAction = document.getElementById('founder-custom-plan-action');
  if (founderAction) {
    if (session?.role === 'founder') founderAction.classList.remove('d-none');
    else founderAction.classList.add('d-none');
  }

  const container = document.getElementById('plans-container');
  if (!container) return;

  container.innerHTML = plans.map(plan => {
    const isCurrent = currentPlanId === plan.id;
    const isStarter = plan.id === 'starter';
    const isCustom = plan.isCustom;
    const borderClass = isCurrent ? 'border-success shadow-md' : (isCustom ? 'border-success shadow-sm' : (isStarter ? 'border-primary shadow-md' : 'border shadow-sm'));
    const priceDisplay = plan.baseFeePaise === 0 ? '₹0' : `₹${(plan.baseFeePaise / 100).toLocaleString('en-IN')}`;
    const overageDisplay = plan.overageRatePaisePerThousand === 0 ? 'No overage permitted' : `₹${plan.overageRatePaisePerThousand / 100} per 1,000 calls`;

    return `
      <div class="col-lg-4 col-md-6">
        <div class="card h-100 ${borderClass} rounded-4 p-4 bg-white position-relative d-flex flex-column">
          ${isCurrent ? `<div class="position-absolute top-0 end-0 translate-middle-y me-4"><span class="badge bg-success px-3 py-1 rounded-pill shadow-sm">Your Active Tier ✓</span></div>` : (isCustom ? `<div class="position-absolute top-0 end-0 translate-middle-y me-4"><span class="badge bg-success-subtle text-success border px-3 py-1 rounded-pill shadow-sm">Custom Enterprise Plan</span></div>` : (isStarter ? `<div class="position-absolute top-0 end-0 translate-middle-y me-4"><span class="badge bg-primary px-3 py-1 rounded-pill shadow-sm">Benchmark Tier</span></div>` : ''))}
          <div class="mb-3">
            <div class="mb-2">${renderPlanBadge(plan.id)}</div>
            <h3 class="h4 fw-bold text-dark mb-1">${plan.name} Tier</h3>
            <p class="text-secondary small">${plan.id === 'free' ? 'For prototyping and sandbox testing.' : (plan.id === 'starter' ? 'For growing startups and production workflows.' : (plan.id === 'pro' ? 'For high-throughput enterprise scale.' : 'Tailored custom specifications per consumer request.'))}</p>
          </div>
          <div class="d-flex align-items-baseline mb-4">
            <span class="display-5 fw-bold ${isStarter ? 'text-primary' : 'text-dark'}">${priceDisplay}</span>
            <span class="text-muted ms-2">/ month</span>
          </div>
          <ul class="list-unstyled mb-4 small text-secondary">
            <li class="mb-2 d-flex align-items-center gap-2"><span class="text-success d-inline-flex">${SVG_ICONS.check}</span> <strong>${plan.perMinuteLimit} req/min</strong> fixed-window rate limit</li>
            <li class="mb-2 d-flex align-items-center gap-2"><span class="text-success d-inline-flex">${SVG_ICONS.check}</span> <strong>${plan.monthlyLimit.toLocaleString()}</strong> monthly hard quota</li>
            <li class="mb-2 d-flex align-items-center gap-2"><span class="text-success d-inline-flex">${SVG_ICONS.check}</span> <strong>${plan.includedCalls.toLocaleString()}</strong> included calls</li>
            <li class="mb-2 d-flex align-items-center gap-2"><span class="${plan.overageRatePaisePerThousand > 0 ? 'text-success' : 'text-muted'} d-inline-flex">${plan.overageRatePaisePerThousand > 0 ? SVG_ICONS.check : SVG_ICONS.close}</span> <span>${overageDisplay}</span></li>
            <li class="d-flex align-items-center gap-2"><span class="text-success d-inline-flex">${SVG_ICONS.check}</span> ${isCustom ? 'Dedicated VIP support & custom SLA' : (plan.id === 'pro' ? 'Dedicated support' : (plan.id === 'starter' ? '24h email SLA' : 'Community support'))}</li>
          </ul>
          <div class="mt-auto">
            <div class="p-2 mb-3 ${isStarter ? 'bg-primary-light text-primary fw-semibold' : 'bg-light text-muted'} rounded text-center small font-monospace">overageRate: ₹${plan.overageRatePaisePerThousand / 100} / 1k</div>
            ${currentTenant && !isCurrent ? `<button type="button" class="btn btn-outline-primary w-100 btn-switch-plan" data-plan="${plan.id}">Switch to ${plan.name} Plan</button>` : (isCurrent ? `<button type="button" class="btn btn-success w-100 disabled" disabled>Active Subscription</button>` : '')}
            ${session?.role === 'founder' ? `<button type="button" class="btn btn-outline-danger btn-sm w-100 mt-2 btn-remove-plan" data-plan="${plan.id}" data-name="${plan.name}">Remove Plan</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (currentTenant) {
    container.querySelectorAll('.btn-switch-plan').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetPlanId = btn.getAttribute('data-plan');
        const confirmed = await showConfirmDialog({
          title: 'Confirm Plan Change',
          message: `Change subscription for ${currentTenant.name} to the ${targetPlanId.toUpperCase()} tier? Rate limits will update immediately.`,
          confirmText: 'Change Plan', confirmVariant: 'primary', icon: SVG_ICONS.plans
        });
        if (!confirmed) return;

        const res = applyPlanChange(currentTenant.id, targetPlanId);
        if (res.success) { showToast(res.message, 'success'); renderDynamicPlans(session); }
        else { showToast(res.message, 'error'); }
      });
    });
  }

  if (session?.role === 'founder') {
    container.querySelectorAll('.btn-remove-plan').forEach(btn => {
      btn.addEventListener('click', async () => {
        const planId = btn.getAttribute('data-plan');
        const planName = btn.getAttribute('data-name');
        if (plans.length <= 1) { showToast('Cannot remove the last remaining plan.', 'warning'); return; }

        const confirmed = await showConfirmDialog({
          title: `Remove ${planName} Plan?`,
          message: `Are you sure you want to permanently delete the "${planName}" plan? Any consumers using it will be safely migrated to Starter tier.`,
          confirmText: 'Yes, Remove Plan', confirmVariant: 'danger', icon: SVG_ICONS.alert
        });
        if (!confirmed) return;

        const res = deletePlan(planId);
        if (res?.success) { showToast(res.message, 'success'); renderDynamicPlans(session); }
        else { showToast(res?.message || 'Failed to remove plan.', 'error'); }
      });
    });
  }
}

function setupCustomPlanModal(session) {
  const openBtn = document.getElementById('btn-open-create-plan');
  const modalEl = document.getElementById('modal-create-custom-plan');
  const form = document.getElementById('form-create-custom-plan');

  if (openBtn && modalEl && window.bootstrap) {
    const modal = new window.bootstrap.Modal(modalEl);
    openBtn.addEventListener('click', () => modal.show());

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('custom-plan-name')?.value.trim();
      const baseFeeRs = Number(document.getElementById('custom-plan-fee')?.value || 0);
      const perMinuteLimit = Number(document.getElementById('custom-plan-rpm')?.value || 20);
      const includedCalls = Number(document.getElementById('custom-plan-included')?.value || 0);
      const monthlyLimit = Number(document.getElementById('custom-plan-limit')?.value || 0);
      const overageRateRs = Number(document.getElementById('custom-plan-overage')?.value || 0);

      if (!name) { showToast('Plan name is required.', 'warning'); return; }

      const newPlan = createCustomPlan({ name, baseFeeRs, perMinuteLimit, includedCalls, monthlyLimit, overageRateRsPerThousand: overageRateRs });
      modal.hide();
      form.reset();
      showToast(`Custom Plan "${newPlan.name}" published successfully!`, 'success');
      renderDynamicPlans(session);
    });
  }
}
