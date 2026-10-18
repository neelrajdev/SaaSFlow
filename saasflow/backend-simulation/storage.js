
export const STORAGE_KEYS = {
  SESSION: 'sf_session',
  PLANS: 'sf_plans',
  TENANTS: 'sf_tenants',
  REQUESTS: 'sf_requests',
  DAILY_USAGE: 'sf_daily_usage',
  INVOICES: 'sf_invoices'
};

const MAX_REQUEST_LOGS = 500;

export const ENTERPRISE_NAMES = {
  shopkart: 'NovaCart Commerce',
  weathernow: 'ClimaCast Analytics',
  logitrack: 'Apex Global Logistics',
  payeasy: 'PayEasy Financial Technologies',
  medibook: 'PulseCare Health Cloud',
  edulearn: 'Syntheta Learning Labs',
  foodrush: 'CraveDash Hyperlocal Delivery'
};

export const SEED_STAFF = {
  shopkart: [
    { id: 'staff_nc_1', name: 'Devon Vance', role: 'Lead Integration Engineer', email: 'devon@novacart.com', apiKey: 'sf_live_shopkart_demo_key_98234', monthlyUsage: 25000 },
    { id: 'staff_nc_2', name: 'Marcus Zhao', role: 'Mobile App Developer', email: 'marcus@novacart.com', apiKey: 'sf_live_novacart_marcus_55102', monthlyUsage: 18000 }
  ],
  weathernow: [
    { id: 'staff_cc_1', name: 'Dr. Sarah Chen', role: 'Principal Data Scientist', email: 'sarah@climacast.io', apiKey: 'sf_live_weathernow_demo_key_11204', monthlyUsage: 4800 },
    { id: 'staff_cc_2', name: 'Tom Higgins', role: 'Sensor Fleet Engineer', email: 'tom@climacast.io', apiKey: 'sf_live_climacast_tom_33918', monthlyUsage: 3000 }
  ],
  logitrack: [
    { id: 'staff_agl_1', name: 'David Sterling', role: 'VP of Supply Chain Systems', email: 'david@apexlogistics.com', apiKey: 'sf_live_logitrack_demo_key_88412', monthlyUsage: 110000 },
    { id: 'staff_agl_2', name: 'Priya Nair', role: 'Dispatch Operations Lead', email: 'priya@apexlogistics.com', apiKey: 'sf_live_apex_priya_77192', monthlyUsage: 75000 }
  ],
  payeasy: [
    { id: 'staff_pe_1', name: 'Vikram Sethi', role: 'Head of Merchant API Services', email: 'vikram@payeasy.io', apiKey: 'sf_live_payeasy_demo_key_44319', monthlyUsage: 35000 },
    { id: 'staff_pe_2', name: 'Ananya Roy', role: 'Senior Checkout Backend Engineer', email: 'ananya@payeasy.io', apiKey: 'sf_live_payeasy_ananya_88123', monthlyUsage: 26250 }
  ],
  medibook: [
    { id: 'staff_pc_1', name: 'Dr. Aris Thorne', role: 'Chief Health Informatics Officer', email: 'aris@pulsecare.health', apiKey: 'sf_live_medibook_demo_key_77123', monthlyUsage: 2100 }
  ],
  edulearn: [
    { id: 'staff_sl_1', name: 'Claire Dupont', role: 'Director of Learning Platforms', email: 'claire@synthetalabs.edu', apiKey: 'sf_live_edulearn_demo_key_55490', monthlyUsage: 16000 },
    { id: 'staff_sl_2', name: 'Karthik Raja', role: 'Assessment Engine Developer', email: 'karthik@synthetalabs.edu', apiKey: 'sf_live_syntheta_karthik_12049', monthlyUsage: 12000 }
  ],
  foodrush: [
    { id: 'staff_cd_1', name: 'Rohan Mehra', role: 'Dispatch Services Lead', email: 'rohan@cravedash.com', apiKey: 'sf_live_foodrush_demo_key_33109', monthlyUsage: 190000 },
    { id: 'staff_cd_2', name: 'Siddharth Nair', role: 'Fleet Telematics Architect', email: 'sid@cravedash.com', apiKey: 'sf_live_cravedash_sid_99014', monthlyUsage: 122000 }
  ]
};

function safeRead(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null || raw === undefined ? defaultValue : JSON.parse(raw);
  } catch (err) {
    console.warn(`[Storage] Failed to parse key "${key}":`, err);
    return defaultValue;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[Storage] Failed to write key "${key}":`, err);
    return false;
  }
}

export async function initStorage() {
  try {
    let plans = safeRead(STORAGE_KEYS.PLANS, null);
    if (!plans || !Array.isArray(plans) || plans.length === 0) {
      const res = await fetch('../data/plans.json').catch(() => fetch('data/plans.json'));
      if (res.ok) { safeWrite(STORAGE_KEYS.PLANS, await res.json()); }
    }

    let tenants = safeRead(STORAGE_KEYS.TENANTS, null);
    if (!tenants || !Array.isArray(tenants) || tenants.length === 0) {
      const res = await fetch('../data/tenants.json').catch(() => fetch('data/tenants.json'));
      if (res.ok) { safeWrite(STORAGE_KEYS.TENANTS, await res.json()); }
    } else {
      let changed = false;
      tenants = tenants.map(t => {
        let updated = { ...t };
        if (ENTERPRISE_NAMES[t.id] && t.name !== ENTERPRISE_NAMES[t.id]) { changed = true; updated.name = ENTERPRISE_NAMES[t.id]; }
        if ((!t.staff || t.staff.length === 0) && SEED_STAFF[t.id]) { changed = true; updated.staff = SEED_STAFF[t.id]; }
        return updated;
      });
      if (changed) safeWrite(STORAGE_KEYS.TENANTS, tenants);
    }

    let invoices = safeRead(STORAGE_KEYS.INVOICES, null);
    if (Array.isArray(invoices) && invoices.length > 0) {
      let invChanged = false;
      invoices = invoices.map(inv => {
        if (ENTERPRISE_NAMES[inv.tenantId] && inv.tenantName !== ENTERPRISE_NAMES[inv.tenantId]) {
          invChanged = true; return { ...inv, tenantName: ENTERPRISE_NAMES[inv.tenantId] };
        }
        return inv;
      });
      if (invChanged) safeWrite(STORAGE_KEYS.INVOICES, invoices);
    }

    let dailyUsage = safeRead(STORAGE_KEYS.DAILY_USAGE, null);
    if (!dailyUsage || !dailyUsage.tenants) {
      const res = await fetch('../data/usage.json').catch(() => fetch('data/usage.json'));
      if (res.ok) { safeWrite(STORAGE_KEYS.DAILY_USAGE, await res.json()); }
    }

    if (safeRead(STORAGE_KEYS.REQUESTS, null) === null) safeWrite(STORAGE_KEYS.REQUESTS, []);
    if (safeRead(STORAGE_KEYS.INVOICES, null) === null) safeWrite(STORAGE_KEYS.INVOICES, []);
    return true;
  } catch (err) {
    console.error('[Storage] Error during initStorage:', err);
    return false;
  }
}

export function getPlans() {
  return safeRead(STORAGE_KEYS.PLANS, [
    { id: 'free', name: 'Free', baseFeePaise: 0, perMinuteLimit: 5, monthlyLimit: 10000, includedCalls: 10000, overageRatePaisePerThousand: 0 },
    { id: 'starter', name: 'Starter', baseFeePaise: 99900, perMinuteLimit: 20, monthlyLimit: 100000, includedCalls: 50000, overageRatePaisePerThousand: 4000 },
    { id: 'pro', name: 'Pro', baseFeePaise: 299900, perMinuteLimit: 60, monthlyLimit: 500000, includedCalls: 200000, overageRatePaisePerThousand: 2000 }
  ]);
}

export function getPlanById(planId) {
  if (!planId) return null;
  return getPlans().find(p => p.id.toLowerCase() === String(planId).toLowerCase()) || null;
}

export function savePlan(plan) {
  const plans = getPlans();
  const idx = plans.findIndex(p => p.id.toLowerCase() === plan.id.toLowerCase());
  if (idx >= 0) plans[idx] = { ...plans[idx], ...plan }; else plans.push(plan);
  safeWrite(STORAGE_KEYS.PLANS, plans);
  return plan;
}

export function createCustomPlan({ name, baseFeeRs, includedCalls, monthlyLimit, perMinuteLimit, overageRateRsPerThousand }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 16);
  const newPlan = {
    id: `custom-${slug}-${Date.now().toString().slice(-4)}`,
    name,
    baseFeePaise: Math.round(Number(baseFeeRs || 0) * 100),
    perMinuteLimit: Math.max(1, Number(perMinuteLimit || 20)),
    monthlyLimit: Math.max(1000, Number(monthlyLimit || 50000)),
    includedCalls: Math.max(0, Number(includedCalls || 25000)),
    overageRatePaisePerThousand: Math.round(Number(overageRateRsPerThousand || 0) * 100),
    isCustom: true
  };
  savePlan(newPlan);
  return newPlan;
}

export function deletePlan(planId) {
  if (!planId) return { success: false, message: 'Invalid plan ID' };
  let plans = getPlans();
  const target = plans.find(p => p.id.toLowerCase() === String(planId).toLowerCase());
  if (!target) return { success: false, message: `Plan "${planId}" not found.` };

  const tenants = getTenants();
  let reassignedCount = 0;
  tenants.forEach(t => {
    if (t.planId && t.planId.toLowerCase() === planId.toLowerCase()) {
      const fallback = planId.toLowerCase() === 'starter' ? 'free' : 'starter';
      updateTenant(t.id, { planId: fallback, nextMonthPlanId: fallback });
      reassignedCount++;
    }
  });

  plans = plans.filter(p => p.id.toLowerCase() !== planId.toLowerCase());
  safeWrite(STORAGE_KEYS.PLANS, plans);
  return {
    success: true,
    message: `Plan "${target.name}" was removed successfully.${reassignedCount > 0 ? ` (${reassignedCount} consumer(s) safely migrated to Starter tier)` : ''}`,
    reassignedCount
  };
}

export const removePlan = deletePlan;

export function getTenants() { return safeRead(STORAGE_KEYS.TENANTS, []); }

export function getTenantById(id) {
  if (!id) return null;
  return getTenants().find(t => t.id.toLowerCase() === String(id).toLowerCase()) || null;
}

export function getTenantByApiKey(apiKey) {
  if (!apiKey) return null;
  const tenants = getTenants();
  const trimmed = String(apiKey).trim();

  for (const t of tenants) {
    if (t.status !== 'active') continue;
    if (t.apiKey === trimmed) {
      return { ...t, matchedStaff: Array.isArray(t.staff) && t.staff.length > 0 ? t.staff[0] : null };
    }
    if (Array.isArray(t.staff)) {
      const found = t.staff.find(s => s.apiKey === trimmed);
      if (found) return { ...t, matchedStaff: found };
    }
  }
  return null;
}

export function updateTenant(id, changes) {
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id.toLowerCase() === String(id).toLowerCase());
  if (idx === -1) return null;
  tenants[idx] = { ...tenants[idx], ...changes };
  safeWrite(STORAGE_KEYS.TENANTS, tenants);
  return tenants[idx];
}

export function createConsumer({ name, planId = 'starter', contactName = 'Admin', contactEmail = '', industry = 'Technology' }) {
  const tenants = getTenants();
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || `consumer${Date.now().toString().slice(-4)}`;
  let id = baseSlug, counter = 1;
  while (tenants.some(t => t.id === id)) { id = `${baseSlug}${counter++}`; }

  const randMaster = Math.floor(10000 + Math.random() * 90000);
  const randStaff = Math.floor(10000 + Math.random() * 90000);
  const staffSlug = contactName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'lead';

  const newConsumer = {
    id,
    name,
    planId,
    industry,
    apiKey: `sf_live_${id}_demo_key_${randMaster}`,
    status: 'active',
    monthlyUsage: 0,
    billingMonth: '2026-10',
    nextMonthPlanId: planId,
    staff: [{
      id: `staff_${id}_1`,
      name: contactName,
      role: 'Founder / Lead Admin',
      email: contactEmail || `${staffSlug}@${id}.io`,
      apiKey: `sf_live_${id}_${staffSlug}_${randStaff}`,
      monthlyUsage: 0
    }]
  };

  tenants.push(newConsumer);
  safeWrite(STORAGE_KEYS.TENANTS, tenants);
  return newConsumer;
}

export function addStaffMember(consumerId, { name, role = 'Integration Engineer', email = '' }) {
  const tenant = getTenantById(consumerId);
  if (!tenant) return null;
  if (!Array.isArray(tenant.staff)) tenant.staff = [];

  const staffId = `staff_${tenant.id}_${(tenant.staff.length + 1)}_${Date.now().toString().slice(-4)}`;
  const randCode = Math.floor(10000 + Math.random() * 90000);
  const slugName = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'staff';

  const newStaff = {
    id: staffId,
    name,
    role,
    email: email || `${slugName}@${tenant.id}.io`,
    apiKey: `sf_live_${tenant.id}_${slugName}_${randCode}`,
    monthlyUsage: 0
  };

  tenant.staff.push(newStaff);
  updateTenant(tenant.id, { staff: tenant.staff });
  return newStaff;
}

export const getConsumers = getTenants;
export const getConsumerById = getTenantById;
export const getConsumerByApiKey = getTenantByApiKey;
export const updateConsumer = updateTenant;
export const addConsumer = createConsumer;

export function getRequests() { return safeRead(STORAGE_KEYS.REQUESTS, []); }

export function addRequest(logEntry) {
  const logs = getRequests();
  logs.unshift(logEntry);
  if (logs.length > MAX_REQUEST_LOGS) logs.length = MAX_REQUEST_LOGS;
  safeWrite(STORAGE_KEYS.REQUESTS, logs);
  return logEntry;
}

export function clearRequests() { safeWrite(STORAGE_KEYS.REQUESTS, []); }

export function getDailyUsage() { return safeRead(STORAGE_KEYS.DAILY_USAGE, { tenants: {} }); }

export function updateDailyUsage(tenantId, dateStr, incrementBy = 1) {
  const usage = getDailyUsage();
  if (!usage.tenants) usage.tenants = {};
  if (!usage.tenants[tenantId]) usage.tenants[tenantId] = { daily: {}, monthlyTotal: 0 };

  const currentDaily = usage.tenants[tenantId].daily[dateStr] || 0;
  usage.tenants[tenantId].daily[dateStr] = currentDaily + incrementBy;
  usage.tenants[tenantId].monthlyTotal = (usage.tenants[tenantId].monthlyTotal || 0) + incrementBy;

  safeWrite(STORAGE_KEYS.DAILY_USAGE, usage);
  return usage.tenants[tenantId];
}

export function getInvoices() { return safeRead(STORAGE_KEYS.INVOICES, []); }

export function getInvoiceById(invoiceId) {
  if (!invoiceId) return null;
  return getInvoices().find(inv => inv.id === invoiceId) || null;
}

export function saveInvoice(invoice) {
  const invoices = getInvoices();
  const idx = invoices.findIndex(inv => inv.id === invoice.id);
  if (idx >= 0) invoices[idx] = { ...invoices[idx], ...invoice }; else invoices.push(invoice);
  safeWrite(STORAGE_KEYS.INVOICES, invoices);
  return invoice;
}

export function markInvoicePaid(invoiceId) {
  const invoices = getInvoices();
  const idx = invoices.findIndex(inv => inv.id === invoiceId);
  if (idx === -1) return false;
  invoices[idx].status = 'paid';
  invoices[idx].paidAt = Date.now();
  safeWrite(STORAGE_KEYS.INVOICES, invoices);
  return true;
}

export function getSession() { return safeRead(STORAGE_KEYS.SESSION, null); }
export function setSession(sessionData) { safeWrite(STORAGE_KEYS.SESSION, sessionData); return sessionData; }
export function clearSession() { localStorage.removeItem(STORAGE_KEYS.SESSION); }

export async function resetAllData() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  await initStorage();
  return true;
}
