
import { getSession, setSession, clearSession, getTenantById } from './storage.js';

export const ROLE_PERMISSIONS = {
  founder: ['overview', 'tenants', 'tenant-detail', 'billing', 'plans', 'playground', 'access-denied'],
  consumer: ['my-api', 'playground', 'plans', 'access-denied'],
  finance: ['billing', 'invoice-detail', 'plans', 'access-denied']
};

export function login(role, tenantId = null) {
  const normalizedRole = String(role).toLowerCase().trim();
  if (!ROLE_PERMISSIONS[normalizedRole]) {
    return { success: false, error: `Invalid role: ${role}. Must be founder, consumer, or finance.` };
  }
  if (normalizedRole === 'consumer') {
    if (!tenantId) return { success: false, error: 'Consumer role requires selecting a tenant.' };
    const tenant = getTenantById(tenantId);
    if (!tenant) return { success: false, error: `Tenant "${tenantId}" not found in system.` };
  }

  const sessionData = {
    role: normalizedRole,
    tenantId: normalizedRole === 'consumer' ? tenantId : null,
    loggedInAt: Date.now()
  };
  setSession(sessionData);
  return { success: true, session: sessionData };
}

export function logout() {
  clearSession();
  return true;
}

export function getCurrentSession() { return getSession(); }

export function canAccess(pageName) {
  const session = getCurrentSession();
  if (!session || !session.role) return false;
  const allowed = ROLE_PERMISSIONS[session.role.toLowerCase()];
  return allowed ? allowed.includes(pageName.toLowerCase()) : false;
}

export function guardPage(pageName, depth = 'pages') {
  const session = getCurrentSession();
  const rootPath = depth === 'pages' ? '../index.html' : 'index.html';
  const deniedPath = depth === 'pages' ? 'access-denied.html' : 'pages/access-denied.html';

  if (!session || !session.role) { window.location.replace(rootPath); return false; }
  if (!canAccess(pageName)) { window.location.replace(deniedPath); return false; }
  return true;
}

export function isFounder() { return getCurrentSession()?.role === 'founder'; }
export function isConsumer() { return getCurrentSession()?.role === 'consumer'; }
export function isFinance() { return getCurrentSession()?.role === 'finance'; }
