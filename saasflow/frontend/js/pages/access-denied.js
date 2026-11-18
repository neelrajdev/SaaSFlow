
import { getCurrentSession } from '../../../backend-simulation/auth.js';
import { safeGoBack, getRoleDashboard } from '../components.js';

document.addEventListener('DOMContentLoaded', () => {
  const session = getCurrentSession();
  const roleDisplay = document.getElementById('current-role-display');
  const backBtn = document.getElementById('btn-back-dashboard');

  const role = session && session.role ? session.role : null;
  if (role) {
    if (roleDisplay) {
      roleDisplay.textContent = role.toUpperCase();
    }
  } else {
    if (roleDisplay) {
      roleDisplay.textContent = 'None (Not Logged In)';
    }
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const fallback = role ? getRoleDashboard(role) : '../index.html';
      safeGoBack(fallback);
    });
  }
});
