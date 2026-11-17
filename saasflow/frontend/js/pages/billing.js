
import { initPage, showToast, showConfirmDialog } from '../app.js';
import { getInvoicesForMonth, getBillingSummary, markInvoicePaid, rupees } from '../../../backend-simulation/billing.js';
import { renderStatusBadge, SVG_ICONS } from '../components.js';

let activeMonth = '2026-10', currentInvoices = [], currentSession = null;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await initPage({
    pageName: 'billing',
    title: 'Billing & Invoicing',
    subtitle: 'Metered usage reconciliation, base fee accounting, and consumer receivables'
  });
  if (!session) return;
  currentSession = session;

  const roleBadge = document.getElementById('billing-role-badge');
  if (roleBadge) {
    const isFounder = session.role === 'founder';
    roleBadge.textContent = isFounder ? 'Founder (Read-only)' : 'Finance Administrator';
    roleBadge.className = `badge ${isFounder ? 'bg-warning-subtle text-warning' : 'bg-primary-subtle text-primary'} border px-2 py-1`;
  }

  loadBillingData(activeMonth);
  setupMonthSelector();
  setupCsvExportButton();
});

function loadBillingData(billingMonth) {
  currentInvoices = getInvoicesForMonth(billingMonth);
  const s = getBillingSummary(billingMonth);

  document.getElementById('kpi-total-billed') && (document.getElementById('kpi-total-billed').textContent = s.totalBilledDisplay);
  document.getElementById('kpi-outstanding') && (document.getElementById('kpi-outstanding').textContent = s.outstandingDisplay);
  document.getElementById('kpi-paid-amount') && (document.getElementById('kpi-paid-amount').textContent = s.paidDisplay);
  document.getElementById('kpi-invoice-count') && (document.getElementById('kpi-invoice-count').textContent = s.invoiceCount);
  document.getElementById('kpi-unpaid-count') && (document.getElementById('kpi-unpaid-count').textContent = `${s.unpaidCount} Unpaid`);

  const tbody = document.getElementById('invoices-table-body');
  if (!tbody) return;

  if (currentInvoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4 small">No consumer invoices generated for billing cycle ${billingMonth}.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentInvoices.map(inv => `
    <tr>
      <td data-label="Invoice ID" class="font-monospace small"><strong>${inv.id}</strong></td>
      <td data-label="Consumer"><strong>${inv.tenantName}</strong><span class="small text-muted font-monospace d-block">${inv.tenantId}</span></td>
      <td data-label="Month">${inv.billingMonth}</td>
      <td data-label="Base Fee" class="font-monospace">${rupees(inv.baseFeePaise)}</td>
      <td data-label="Included" class="font-monospace small text-muted">${inv.includedCalls.toLocaleString()}</td>
      <td data-label="Overage Calls" class="font-monospace small ${inv.overageCalls > 0 ? 'text-warning fw-semibold' : 'text-muted'}">${inv.overageCalls.toLocaleString()}</td>
      <td data-label="Overage Charge" class="font-monospace ${inv.overageChargePaise > 0 ? 'text-warning fw-semibold' : 'text-muted'}">${rupees(inv.overageChargePaise)}</td>
      <td data-label="Total Amount" class="font-monospace fw-bold text-dark">${rupees(inv.totalPaise)}</td>
      <td data-label="Status">${renderStatusBadge(inv.status)}</td>
      <td data-label="Action">
        <div class="d-flex align-items-center gap-1">
          <a href="invoice-detail.html?invoiceId=${inv.id}" class="btn btn-sm btn-outline-primary py-1 px-2" title="Inspect Invoice">Inspect</a>
          ${currentSession?.role === 'finance' && inv.status !== 'paid' ? `<button type="button" class="btn btn-sm btn-success py-1 px-2 btn-table-mark-paid" data-invoice-id="${inv.id}" title="Mark as Paid">Mark Paid</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-table-mark-paid').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const invoiceId = btn.getAttribute('data-invoice-id');
      const confirmed = await showConfirmDialog({
        title: 'Mark Invoice as Paid?',
        message: `Confirm payment settlement for Invoice ${invoiceId}?`,
        confirmText: 'Mark as Paid', confirmVariant: 'success', icon: SVG_ICONS.billing
      });
      if (!confirmed) return;

      if (markInvoicePaid(invoiceId)) {
        showToast(`Invoice ${invoiceId} marked as PAID!`, 'success');
        loadBillingData(activeMonth);
      } else {
        showToast(`Failed to update invoice ${invoiceId}.`, 'error');
      }
    });
  });
}

function setupMonthSelector() {
  document.getElementById('select-billing-month')?.addEventListener('change', (e) => {
    activeMonth = e.target.value;
    loadBillingData(activeMonth);
    showToast(`Loaded invoices for ${activeMonth}`, 'info');
  });
}

function setupCsvExportButton() {
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    if (currentInvoices.length === 0) { showToast('No invoice data available to export.', 'warning'); return; }

    const headers = ['Invoice ID', 'Consumer ID', 'Consumer Name', 'Billing Month', 'Base Fee (Rs)', 'Included Calls', 'Actual Calls', 'Overage Calls', 'Overage Charge (Rs)', 'Total (Rs)', 'Status'];
    const rows = currentInvoices.map(inv => [
      inv.id, inv.tenantId, `"${inv.tenantName}"`, inv.billingMonth,
      (inv.baseFeePaise / 100).toFixed(2), inv.includedCalls, inv.actualCalls,
      inv.overageCalls, (inv.overageChargePaise / 100).toFixed(2), (inv.totalPaise / 100).toFixed(2), inv.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `saasflow-invoices-${activeMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(`Exported ${currentInvoices.length} invoices to CSV`, 'success');
  });
}
