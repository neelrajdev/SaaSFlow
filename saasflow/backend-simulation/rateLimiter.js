
const windows = {};
const staffWindows = {};
const WINDOW_DURATION_MS = 60 * 1000;

export function check(tenantId, planLimit, now = Date.now(), staffId = null) {
  const tid = String(tenantId).toLowerCase();
  const limit = Math.max(1, Number(planLimit) || 1);

  if (!windows[tid] || now >= windows[tid].windowStart + WINDOW_DURATION_MS) {
    windows[tid] = { count: 0, windowStart: now };
  }

  const cur = windows[tid];
  const resetAt = cur.windowStart + WINDOW_DURATION_MS;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));

  if (cur.count >= limit) {
    return { allowed: false, remaining: 0, resetAt, retryAfter, used: cur.count };
  }

  cur.count += 1;

  if (staffId) {
    const sKey = `${tid}:${String(staffId).toLowerCase()}`;
    if (!staffWindows[sKey] || now >= staffWindows[sKey].windowStart + WINDOW_DURATION_MS) {
      staffWindows[sKey] = { count: 0, windowStart: cur.windowStart };
    }
    staffWindows[sKey].count += 1;
  }

  return { allowed: true, remaining: Math.max(0, limit - cur.count), resetAt, retryAfter: 0, used: cur.count };
}

export function getConsumerRPM(tenantId, planLimit = 20, now = Date.now()) {
  const tid = String(tenantId).toLowerCase();
  const limit = Math.max(1, Number(planLimit) || 20);

  if (!windows[tid] || now >= windows[tid].windowStart + WINDOW_DURATION_MS) {
    return { currentRpm: 0, limit, remainingRpm: limit, utilizationPercent: 0, resetInSeconds: 60, isThrottled: false, status: 'idle' };
  }

  const win = windows[tid];
  const count = win.count;
  const pct = Math.min(100, Math.round((count / limit) * 100));
  const resetInSeconds = Math.max(1, Math.ceil(((win.windowStart + WINDOW_DURATION_MS) - now) / 1000));

  let status = 'normal';
  if (count >= limit) status = 'throttled';
  else if (pct >= 80) status = 'critical';
  else if (pct >= 50) status = 'moderate';

  return { currentRpm: count, limit, remainingRpm: Math.max(0, limit - count), utilizationPercent: pct, resetInSeconds, isThrottled: count >= limit, status };
}

export function getStaffRPM(tenantId, staffId, now = Date.now()) {
  if (!tenantId || !staffId) return 0;
  const sKey = `${String(tenantId).toLowerCase()}:${String(staffId).toLowerCase()}`;
  if (!staffWindows[sKey] || now >= staffWindows[sKey].windowStart + WINDOW_DURATION_MS) return 0;
  return staffWindows[sKey].count;
}

export function getAllStaffRPM(tenantId, staffList = [], now = Date.now()) {
  if (!Array.isArray(staffList)) return [];
  return staffList.map(s => ({ ...s, currentRpm: getStaffRPM(tenantId, s.id, now) }));
}

export function getWindow(tenantId, now = Date.now()) {
  const tid = String(tenantId).toLowerCase();
  if (!windows[tid] || now >= windows[tid].windowStart + WINDOW_DURATION_MS) {
    return { count: 0, windowStart: now, remainingSeconds: 60 };
  }
  const resetAt = windows[tid].windowStart + WINDOW_DURATION_MS;
  return { count: windows[tid].count, windowStart: windows[tid].windowStart, remainingSeconds: Math.ceil((resetAt - now) / 1000) };
}

export function resetTenant(tenantId) {
  const tid = String(tenantId).toLowerCase();
  delete windows[tid];
  Object.keys(staffWindows).forEach(k => { if (k.startsWith(`${tid}:`)) delete staffWindows[k]; });
}

export function resetAll() {
  Object.keys(windows).forEach(k => delete windows[k]);
  Object.keys(staffWindows).forEach(k => delete staffWindows[k]);
}
