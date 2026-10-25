
import { getTenants, getTenantById, getPlanById, getInvoices, saveInvoice, updateTenant } from './storage.js';

export function paise(rupeeAmount) { return Math.round(Number(rupeeAmount) * 100); }

export function rupees(paiseAmount) {
  return `₹${Math.round(Number(paiseAmount || 0) / 100).toLocaleString('en-IN')}`;
}

export function calcInvoice(tenant, plan, monthUsage) {
  const actualCalls = Math.max(0, Number(monthUsage) || 0);
  const includedCalls = plan ? Number(plan.includedCalls) : 0;
  const baseFeePaise = plan ? Number(plan.baseFeePaise) : 0;
  const overageRate = plan ? Number(plan.overageRatePaisePerThousand) : 0;

  const overageCalls = Math.max(0, actualCalls - includedCalls);
  const overageChargePaise = Math.round((overageCalls * overageRate) / 1000);
  const totalPaise = baseFeePaise + overageChargePaise;

  return {
    baseFeePaise, includedCalls, actualCalls, overageCalls, overageChargePaise, totalPaise,
    baseFeeDisplay: rupees(baseFeePaise),
    overageChargeDisplay: rupees(overageChargePaise),
    totalDisplay: rupees(totalPaise)
  };
}

export function generateInvoiceId(tenantId, billingMonth) {
  return `INV-${String(tenantId).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${billingMonth}`;
}

export function generateInvoices(billingMonth = '2026-10') {
  const tenants = getTenants();
  const existingInvoices = getInvoices();
  const generated = [];

  tenants.forEach(tenant => {
    const invoiceId = generateInvoiceId(tenant.id, billingMonth);
    const existing = existingInvoices.find(inv => inv.id === invoiceId);

    if (existing) {
      generated.push(existing);
    } else {
      const plan = getPlanById(tenant.planId);
      const usage = tenant.monthlyUsage || 0;
      const calc = calcInvoice(tenant, plan, usage);
      const isPaid = !(tenant.id === 'payeasy' || tenant.id === 'foodrush');

      const newInvoice = {
        id: invoiceId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        billingMonth,
        planId: tenant.planId,
        planName: plan ? plan.name : 'Custom',
        baseFeePaise: calc.baseFeePaise,
        includedCalls: calc.includedCalls,
        actualCalls: calc.actualCalls,
        overageCalls: calc.overageCalls,
        overageChargePaise: calc.overageChargePaise,
        totalPaise: calc.totalPaise,
        status: isPaid ? 'paid' : 'unpaid',
        issuedAt: new Date(billingMonth + '-28').getTime(),
        paidAt: isPaid ? new Date(billingMonth + '-29').getTime() : null
      };
      saveInvoice(newInvoice);
      generated.push(newInvoice);
    }
  });
  return generated;
}

export function getInvoicesForMonth(billingMonth = '2026-10') {
  const all = getInvoices().filter(inv => inv.billingMonth === billingMonth);
  return all.length === 0 ? generateInvoices(billingMonth) : all;
}

export function getInvoiceById(invoiceId) {
  if (!invoiceId) return null;
  let invoices = getInvoices();
  let invoice = invoices.find(inv => inv.id === invoiceId);
  if (!invoice) {
    const match = String(invoiceId).match(/INV-.*-(\d{4}-\d{2})/i);
    getInvoicesForMonth(match ? match[1] : '2026-10');
    invoice = getInvoices().find(inv => inv.id === invoiceId);
  }
  return invoice || null;
}

export function markInvoicePaid(invoiceId) {
  if (!invoiceId) return null;
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return null;
  invoice.status = 'paid';
  invoice.paidAt = Date.now();
  saveInvoice(invoice);
  return invoice;
}

export function getBillingSummary(billingMonth = '2026-10') {
  const invoices = getInvoicesForMonth(billingMonth);
  let totalBilledPaise = 0, paidPaise = 0, outstandingPaise = 0, paidCount = 0, unpaidCount = 0;

  invoices.forEach(inv => {
    totalBilledPaise += inv.totalPaise;
    if (inv.status === 'paid') { paidPaise += inv.totalPaise; paidCount++; }
    else { outstandingPaise += inv.totalPaise; unpaidCount++; }
  });

  return {
    billingMonth, totalBilledPaise, paidPaise, outstandingPaise,
    invoiceCount: invoices.length, paidCount, unpaidCount,
    totalBilledDisplay: rupees(totalBilledPaise),
    paidDisplay: rupees(paidPaise),
    outstandingDisplay: rupees(outstandingPaise)
  };
}

export function applyPlanChange(tenantId, newPlanId) {
  const tenant = getTenantById(tenantId);
  if (!tenant) return { success: false, message: `Consumer "${tenantId}" not found.` };
  const newPlan = getPlanById(newPlanId);
  if (!newPlan) return { success: false, message: `Plan "${newPlanId}" does not exist.` };

  const oldPlanId = tenant.planId;
  updateTenant(tenant.id, { planId: newPlanId, nextMonthPlanId: newPlanId });

  return {
    success: true,
    message: `Upgraded ${tenant.name} from ${oldPlanId.toUpperCase()} to ${newPlanId.toUpperCase()}. Rate limits updated immediately! New subscription base fee will apply from next month.`,
    oldPlanId,
    newPlanId,
    newLimit: newPlan.perMinuteLimit
  };
}

export function getStaffUsageAttribution(tenantId, billingMonth = '2026-10') {
  const tenant = getTenantById(tenantId);
  if (!tenant) return [];

  const staffList = Array.isArray(tenant.staff) && tenant.staff.length > 0
    ? tenant.staff
    : [{ id: `staff_${tenant.id}_default`, name: 'Primary Admin Key', role: 'Account Owner', monthlyUsage: tenant.monthlyUsage || 0, apiKey: tenant.apiKey }];

  const plan = getPlanById(tenant.planId);
  const totalCalls = tenant.monthlyUsage || 0;
  const calc = calcInvoice(tenant, plan, totalCalls);
  const totalOveragePaise = calc.overageChargePaise || 0;

  return staffList.map(s => {
    const sCalls = s.monthlyUsage || 0;
    const shareRatio = totalCalls > 0 ? (sCalls / totalCalls) : (1 / staffList.length);
    const attributedOveragePaise = Math.round(totalOveragePaise * shareRatio);
    return {
      id: s.id,
      name: s.name,
      role: s.role || 'Team Member',
      email: s.email || `${s.id}@${tenant.id}.io`,
      apiKey: s.apiKey,
      calls: sCalls,
      percent: totalCalls > 0 ? Math.round(shareRatio * 100) : 0,
      attributedOveragePaise,
      attributedOverageDisplay: rupees(attributedOveragePaise)
    };
  });
}
