
import { getTenantByApiKey, getPlanById, updateTenant, addRequest, updateDailyUsage } from './storage.js';
import { check as checkRateLimit } from './rateLimiter.js';

const ENDPOINT_DATA = {
  '/api/v1/weather': { temperature: 28, unit: 'Celsius', city: 'Delhi', humidity: '72%', condition: 'Partly Cloudy' },
  '/api/v1/stock': { symbol: 'RELIANCE', price: 2847.50, currency: 'INR', change: '+1.2%', volume: 1240000, marketStatus: 'Open' },
  '/api/v1/users': { totalUsers: 15420, activeToday: 12300, newRegistrations: 234, status: 'healthy' },
  '/api/v1/analytics': { pageViews: 45230, uniqueSessions: 12100, bounceRate: '34.2%', avgSessionDuration: '4m 12s' },
  '/api/v1/payments': { processedCount: 892, totalVolumePaise: 42350000, formattedVolume: '₹4,23,500', failedTransactions: 12 }
};

function generateRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

function simulateDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function handleRequest(apiKey, endpoint = '/api/v1/weather', now = Date.now(), options = {}) {
  const requestId = generateRequestId();
  const cleanEndpoint = String(endpoint).trim() || '/api/v1/weather';
  const tenant = getTenantByApiKey(apiKey);
  if (!tenant) {
    const responseTime = options.skipDelay ? 1 : 15;
    addRequest({
      id: requestId, tenantId: 'unknown', endpoint: cleanEndpoint,
      timestamp: now, httpStatus: 401, responseTime, result: 'Unauthorized', errorReason: 'Invalid API key'
    });
    return {
      httpStatus: 401,
      body: { status: 'error', statusCode: 401, requestId, error: 'Unauthorized', message: 'Invalid or missing API key.' },
      tenantId: null, responseTime, rateLimitInfo: null
    };
  }
  const plan = getPlanById(tenant.planId);
  const perMinuteLimit = plan ? plan.perMinuteLimit : 5;
  const staffMember = tenant.matchedStaff || null;
  const staffId = staffMember ? staffMember.id : null;
  const rateCheck = checkRateLimit(tenant.id, perMinuteLimit, now, staffId);

  if (!rateCheck.allowed) {
    const responseTime = options.skipDelay ? 1 : 12;
    addRequest({
      id: requestId, tenantId: tenant.id, staffId, staffName: staffMember ? staffMember.name : 'Master Key',
      endpoint: cleanEndpoint, timestamp: now, httpStatus: 429, responseTime,
      result: 'Rate Limited', errorReason: `Per-minute limit exceeded (${perMinuteLimit} req/min)`
    });
    return {
      httpStatus: 429,
      body: {
        status: 'error', statusCode: 429, requestId, error: 'Too Many Requests',
        message: `Rate limit of ${perMinuteLimit} requests per minute exceeded for ${tenant.name}.`,
        staffMember: staffMember ? staffMember.name : null, retryAfter: rateCheck.retryAfter
      },
      tenantId: tenant.id, responseTime,
      rateLimitInfo: { remaining: 0, retryAfter: rateCheck.retryAfter, resetAt: rateCheck.resetAt }
    };
  }
  const monthlyLimit = plan ? plan.monthlyLimit : 10000;
  const currentUsage = tenant.monthlyUsage || 0;

  if (currentUsage >= monthlyLimit) {
    const responseTime = options.skipDelay ? 1 : 18;
    addRequest({
      id: requestId, tenantId: tenant.id, endpoint: cleanEndpoint,
      timestamp: now, httpStatus: 429, responseTime, result: 'Quota Exhausted',
      errorReason: `Monthly quota limit reached (${monthlyLimit} calls)`
    });
    return {
      httpStatus: 429,
      body: {
        status: 'error', statusCode: 429, requestId, error: 'Monthly Quota Exhausted',
        message: `Monthly quota of ${monthlyLimit.toLocaleString()} calls has been reached.`, quotaExhausted: true
      },
      tenantId: tenant.id, responseTime,
      rateLimitInfo: { remaining: 0, retryAfter: 0, quotaExhausted: true }
    };
  }
  let latency = 250;
  if (!options.skipDelay) {
    latency = Math.floor(Math.random() * 400) + 200;
    await simulateDelay(latency);
  }

  const tenantChanges = { monthlyUsage: currentUsage + 1 };
  if (staffMember && Array.isArray(tenant.staff)) {
    const sIdx = tenant.staff.findIndex(s => s.id === staffMember.id);
    if (sIdx >= 0) {
      tenant.staff[sIdx] = { ...tenant.staff[sIdx], monthlyUsage: (tenant.staff[sIdx].monthlyUsage || 0) + 1 };
      tenantChanges.staff = tenant.staff;
    }
  }
  updateTenant(tenant.id, tenantChanges);

  const todayStr = new Date(now).toISOString().split('T')[0];
  updateDailyUsage(tenant.id, todayStr, 1);

  const mockData = ENDPOINT_DATA[cleanEndpoint] || { message: 'Processed successfully.', endpoint: cleanEndpoint };
  const responseData = { ...mockData, updatedAt: new Date(now).toISOString() };

  addRequest({
    id: requestId, tenantId: tenant.id, staffId, staffName: staffMember ? staffMember.name : 'Master Key',
    endpoint: cleanEndpoint, timestamp: now, httpStatus: 200, responseTime: latency,
    result: 'Success', errorReason: null
  });

  return {
    httpStatus: 200,
    body: { status: 'success', statusCode: 200, requestId, staffMember: staffMember ? staffMember.name : 'Master Key', data: responseData },
    tenantId: tenant.id, responseTime: latency,
    rateLimitInfo: { remaining: rateCheck.remaining, retryAfter: 0, resetAt: rateCheck.resetAt }
  };
}
