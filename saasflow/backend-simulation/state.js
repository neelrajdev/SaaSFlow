
import * as Storage from './storage.js';

export { Storage as storage };
export const getSession = Storage.getSession;
export const getTenants = Storage.getTenants;
export const getTenantById = Storage.getTenantById;
export const getPlans = Storage.getPlans;
export const getPlanById = Storage.getPlanById;
export const getRequests = Storage.getRequests;
export const getInvoices = Storage.getInvoices;

export const createConsumer = Storage.createConsumer;
export const addStaffMember = Storage.addStaffMember;
export const createCustomPlan = Storage.createCustomPlan;
export const savePlan = Storage.savePlan;
export const deletePlan = Storage.deletePlan;
export const removePlan = Storage.removePlan;

export const getConsumers = Storage.getTenants;
export const getConsumerById = Storage.getTenantById;

export function getCurrentTenant() {
  const session = Storage.getSession();
  return (session && session.role === 'consumer' && session.tenantId) ? Storage.getTenantById(session.tenantId) : null;
}
export const getCurrentConsumer = getCurrentTenant;

export function getActivePlan(tenant) {
  return (tenant && tenant.planId) ? Storage.getPlanById(tenant.planId) : null;
}

export function calcMRR() {
  return Storage.getTenants().reduce((total, t) => {
    if (t.status === 'active') {
      const plan = Storage.getPlanById(t.planId);
      if (plan && plan.baseFeePaise) total += plan.baseFeePaise;
    }
    return total;
  }, 0);
}

export function getTenantUsageSummary(tenantId) {
  const tenant = Storage.getTenantById(tenantId);
  if (!tenant) return null;

  const plan = Storage.getPlanById(tenant.planId);
  const monthlyLimit = plan ? plan.monthlyLimit : 10000;
  const used = tenant.monthlyUsage || 0;
  const percent = Math.min(100, Math.round((used / monthlyLimit) * 100));

  let status = 'normal';
  if (percent >= 90) status = 'critical';
  else if (percent >= 70) status = 'warning';

  return { tenantId, name: tenant.name, planId: tenant.planId, used, monthlyLimit, percent, status };
}
