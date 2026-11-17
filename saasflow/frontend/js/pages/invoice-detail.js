
import { initPage, showToast, showConfirmDialog, safeGoBack, updateBreadcrumbs } from '../app.js';
import { getInvoiceById, markInvoicePaid, rupees, getStaffUsageAttribution } from '../../../backend-simulation/billing.js';
import { renderStatusBadge, SVG_ICONS } from '../components.js';

let currentInvoice = null;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initPage({
    pageName: 'invoice-detail',
    title: 'Invoice Line Item Audit',
    subtitle: 'Reconcile metered API calls, overage rate arithmetic, and record payment settlement'
  });
  if (!session) return;

  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('invoiceId') || 'INV-PAYEASY-2026-10';

  currentInvoice = getInvoiceById(invoiceId);
  if (!currentInvoice) {
    showToast(`Invoice "${invoiceId}" not found.`, 'error');
    setTimeout(() => window.location.href = 'billing.html', 1500);
    return;
  }

  renderInvoicePaper();
  updateBreadcrumbs([{ label: 'Billing', href: 'billing.html' }, { label: currentInvoice.id, active: true }]);

  document.querySelector('a[href="billing.html"]')?.addEventListener('click', (e) => {
    e.preventDefault(); safeGoBack('billing.html');
  });

  setupMarkAsPaid();
});

function renderInvoicePaper() {
  const inv = currentInvoice;

  document.getElementById('invoice-id-display').textContent = inv.id;
  document.getElementById('invoice-status-badge').innerHTML = renderStatusBadge(inv.status);
  document.getElementById('invoice-date-issued').textContent = `Billing Cycle: ${inv.billingMonth}`;

  document.getElementById('paper-invoice-id').textContent = inv.id;
  document.getElementById('paper-invoice-date').textContent = new Date(inv.issuedAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('paper-tenant-name').textContent = inv.tenantName;
  document.getElementById('paper-tenant-id').textContent = inv.tenantId;
  document.getElementById('paper-plan-name').textContent = `${inv.planName || inv.planId.toUpperCase()} Plan`;
  document.getElementById('paper-included-quota').textContent = `${inv.includedCalls.toLocaleString()} calls`;
  document.getElementById('paper-actual-usage').textContent = `${inv.actualCalls.toLocaleString()} calls`;

  const baseRs = (inv.baseFeePaise / 100).toFixed(2);
  const overageRs = (inv.overageChargePaise / 100).toFixed(2);
  const totalRs = (inv.totalPaise / 100).toFixed(2);

  document.getElementById('paper-base-fee').textContent = `₹${Number(baseRs).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('paper-overage-volume').textContent = `${inv.overageCalls.toLocaleString()} calls`;
  document.getElementById('paper-overage-calc-details').textContent = `${inv.overageCalls.toLocaleString()} excess calls above ${inv.includedCalls.toLocaleString()} included quota`;
  document.getElementById('paper-overage-charge').textContent = `₹${Number(overageRs).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('paper-subtotal').textContent = `₹${Number(totalRs).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('paper-total-amount').textContent = `₹${Number(totalRs).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const payBox = document.getElementById('paper-payment-box');
  const payHeading = document.getElementById('paper-payment-heading');
  const paySub = document.getElementById('paper-payment-sub');
  const payBadge = document.getElementById('paper-payment-badge');
  const payIcon = document.getElementById('paper-payment-icon');
  const markPaidBtn = document.getElementById('btn-mark-paid');

  if (inv.status === 'paid') {
    if (payBox) { payBox.style.backgroundColor = 'var(--success-bg)'; payBox.style.borderColor = 'var(--success-border)'; }
    if (payIcon) payIcon.innerHTML = `<span class="text-success d-inline-flex">${SVG_ICONS.check}</span>`;
    if (payHeading) payHeading.textContent = 'Payment Status: PAID';
    if (paySub) paySub.textContent = `Settled on ${new Date(inv.paidAt || Date.now()).toLocaleDateString()}`;
    if (payBadge) { payBadge.textContent = 'Paid ✓'; payBadge.className = 'badge bg-success px-3 py-2'; }
    if (markPaidBtn) { markPaidBtn.disabled = true; markPaidBtn.innerHTML = 'Paid'; markPaidBtn.className = 'btn btn-secondary disabled'; }
  } else {
    if (payBox) { payBox.style.backgroundColor = 'var(--warning-bg)'; payBox.style.borderColor = 'var(--warning-border)'; }
    if (payIcon) payIcon.innerHTML = `<span class="text-warning d-inline-flex">${SVG_ICONS.billing}</span>`;
    if (payHeading) payHeading.textContent = 'Payment Status: UNPAID';
    if (paySub) paySub.textContent = 'Awaiting payment verification by Finance.';
    if (payBadge) { payBadge.textContent = 'Awaiting Payment'; payBadge.className = 'badge bg-warning text-dark px-3 py-2'; }
    if (markPaidBtn) { markPaidBtn.disabled = false; markPaidBtn.innerHTML = `${SVG_ICONS.billing} <span>Mark as Paid</span>`; markPaidBtn.className = 'btn btn-success fw-semibold d-flex align-items-center gap-2'; }
  }

  renderStaffAttributionTable(inv);
}

function renderStaffAttributionTable(inv) {
  const tbody = document.getElementById('paper-staff-attribution-tbody');
  if (!tbody) return;

  const attributions = getStaffUsageAttribution(inv.tenantId, inv.billingMonth);
  if (attributions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-2">No team member sub-keys recorded for this billing cycle.</td></tr>`;
    return;
  }

  tbody.innerHTML = attributions.map(att => `
    <tr>
      <td><strong>${att.name}</strong><span class="small font-monospace text-muted d-block">${att.apiKey ? `...${att.apiKey.slice(-5)}` : 'Master Key'}</span></td>
      <td><span class="badge bg-light text-dark border">${att.role}</span></td>
      <td class="text-center font-monospace">${att.calls.toLocaleString()}</td>
      <td class="text-center"><div class="d-inline-flex align-items-center gap-1 font-monospace"><span>${att.percent}%</span></div></td>
      <td class="text-end font-monospace ${att.attributedOveragePaise > 0 ? 'text-warning fw-semibold' : 'text-muted'}">${att.attributedOverageDisplay}</td>
    </tr>
  `).join('');
}

function setupMarkAsPaid() {
  const markPaidBtn = document.getElementById('btn-mark-paid');
  if (!markPaidBtn) return;

  markPaidBtn.addEventListener('click', async () => {
    if (currentInvoice.status === 'paid') return;

    const confirmed = await showConfirmDialog({
      title: 'Mark Invoice as Paid?',
      message: `Confirm that payment of ${rupees(currentInvoice.totalPaise)} for invoice ${currentInvoice.id} has cleared.`,
      confirmText: 'Confirm Payment',
      confirmVariant: 'success',
      icon: SVG_ICONS.billing
    });
    if (!confirmed) return;

    const updated = markInvoicePaid(currentInvoice.id);
    if (updated) {
      currentInvoice = updated;
      renderInvoicePaper();
      showToast(`Invoice ${currentInvoice.id} marked as PAID!`, 'success');
    }
  });
}
