
import { initStorage, resetAllData, getSession, getTenantById } from '../../backend-simulation/storage.js';
import { guardPage } from '../../backend-simulation/auth.js';
import { renderLayout, renderToast, showConfirmDialog, safeGoBack, updateBreadcrumbs, SVG_ICONS } from './components.js';
import { resetAll as resetRateLimiter } from '../../backend-simulation/rateLimiter.js';

export { showConfirmDialog, safeGoBack, updateBreadcrumbs };

export async function initPage({ pageName, title = '', subtitle = '', breadcrumbs = null, backButton = null }) {
  await initStorage();
  if (!guardPage(pageName)) return null;

  const session = getSession();
  const role = session ? session.role : 'founder';
  const consumer = session && session.tenantId ? getTenantById(session.tenantId) : null;
  const tenantName = consumer ? consumer.name : (session && session.tenantId ? session.tenantId.toUpperCase() : '');

  renderLayout({ role, tenantName, currentPage: pageName, title, subtitle, breadcrumbs, backButton });
  return session;
}

export function showToast(message, type = 'info', duration = 3500) {
  renderToast({ message, type, duration });
}

export function navigateTo(url) { window.location.href = url; }

export async function handleGlobalReset() {
  const confirmed = await showConfirmDialog({
    title: 'Reset Demo Data?',
    message: 'This will restore original consumer plans, quotas, and seed invoices. Are you sure you want to proceed?',
    confirmText: 'Reset Demo Data',
    confirmVariant: 'danger',
    icon: SVG_ICONS.alert
  });

  if (confirmed) {
    await resetAllData();
    resetRateLimiter();
    showToast('Demo data reset successfully!', 'success');
    setTimeout(() => window.location.reload(), 600);
  }
}
