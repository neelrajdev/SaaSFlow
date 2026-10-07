# SaaSFlow: Project Structure & File Guide

This document explains the purpose, architectural role, and responsibility of every file and folder in **SaaSFlow**.

---

## 1. Directory Overview

```text
saasflow/
├── frontend/             # Visual presentation layer (HTML, CSS, UI controllers)
├── backend-simulation/   # Headless simulation engine (Data storage, rate limiting, billing)
├── data/                 # Seed JSON and CSV datasets
└── docs/                 # Documentation, architectural specs, and test reports
```

---

## 2. Frontend Layer (`frontend/`)

The frontend layer contains zero business logic calculations. It only handles rendering data to the screen, capturing user input, and delegating operations to `backend-simulation/`.

### 2.1 HTML Pages (`frontend/pages/` and `frontend/index.html`)

- `frontend/index.html` (Screen S1: Demo Login)
  - **Purpose**: Landing page and role-selection screen.
  - **Features**: Role cards for Founder, API Consumer, and Finance; dropdown for Consumer tenant selection; Reset Demo Data button.
  - **Linked JS**: `frontend/js/pages/login.js`.

- `frontend/pages/overview.html` (Screen S2: Founder Overview)
  - **Purpose**: Founder executive dashboard.
  - **Features**: System KPI cards (Total API calls, Successful, Blocked, Est. MRR), Top tenants table, Quota progress indicators, and Recent Activity log.
  - **Linked JS**: `frontend/js/pages/overview.js`.

- `frontend/pages/tenants.html` (Screen S3: Tenants Directory)
  - **Purpose**: Full tenant management table for Founder.
  - **Features**: Filterable and searchable table of all tenants with tier badges, quota utilization bars, and links to tenant details.
  - **Linked JS**: `frontend/js/pages/tenants.js`.

- `frontend/pages/tenant-detail.html` (Screen S4: Tenant Detail)
  - **Purpose**: Detailed diagnostic page for an individual tenant.
  - **Features**: Masked API key display, per-minute and monthly quota indicators, 7-day usage chart, recent request log, and plan upgrade/downgrade selector.
  - **Linked JS**: `frontend/js/pages/tenant-detail.js`.

- `frontend/pages/my-api.html` (Screen S5: Consumer My API)
  - **Purpose**: Consumer-specific API credentials dashboard.
  - **Features**: Masked API key with one-click copy button, current per-minute window counter, monthly quota progress bar, and links to Playground and Plans. Strictly isolates tenant data.
  - **Linked JS**: `frontend/js/pages/my-api.js`.

- `frontend/pages/playground.html` (Screen S6: API Playground)
  - **Purpose**: Interactive API testing console.
  - **Features**: Endpoint input selector, Send Request button, live response code badge (`200`, `401`, `429`), JSON syntax viewer, simulated latency badge, countdown timer on 429 throttling, and local request history log.
  - **Linked JS**: `frontend/js/pages/playground.js`.

- `frontend/pages/billing.html` (Screen S7: Billing Dashboard)
  - **Purpose**: Financial reporting screen for Finance and Founder.
  - **Features**: Billing month selector, high-level billing KPI summary cards (Total Billed, Outstanding, Paid, Invoices Count), and filterable invoice table.
  - **Linked JS**: `frontend/js/pages/billing.js`.

- `frontend/pages/invoice-detail.html` (Screen S8: Invoice Detail)
  - **Purpose**: Line-item breakdown of a specific tenant's monthly invoice.
  - **Features**: Detailed billing calculations (Base fee, included calls, actual calls, overage calls, overage charge, total amount), payment status indicator, and Finance "Mark as Paid" button.
  - **Linked JS**: `frontend/js/pages/invoice-detail.js`.

- `frontend/pages/plans.html` (Screen S9: Plans Comparison)
  - **Purpose**: Public/shared comparison table of subscription tiers.
  - **Features**: Three pricing cards (Free, Starter, Pro) dynamically populated from `plans.json` displaying base price, per-minute rate limits, monthly limits, and overage rates.
  - **Linked JS**: `frontend/js/pages/plans.js`.

- `frontend/pages/access-denied.html` (Screen S10: Access Denied)
  - **Purpose**: Fallback security guard screen.
  - **Features**: Friendly access denial explanation with "Back to Dashboard" and "Return to Login" navigation buttons.
  - **Linked JS**: `frontend/js/pages/access-denied.js`.

### 2.2 Stylesheet (`frontend/css/styles.css`)

- **Purpose**: Centralized design system using custom CSS custom properties (variables) aligned with PRD specifications (`--primary: #4F46E5`, `--text-primary: #111827`, etc.).
- **Components Styled**: Layout sidebar and mobile offcanvas, responsive KPI cards, accessible quota bars with threshold colors (Green `<70%`, Warning `70-90%`, Danger `>90%`), terminal-style JSON response panels, and loading skeletons.

### 2.3 Shared UI Modules (`frontend/js/`)

- `frontend/js/app.js`: Shared application orchestrator. Provides navigation helpers (`navigateTo`), toast notifications (`showToast`), session verification, and data reset handling.
- `frontend/js/components.js`: Pure functional component library exporting HTML template generators (`renderLayout`, `renderKPICard`, `renderQuotaBar`, `renderToast`, `renderEmptyState`, `renderSkeleton`, `renderResponsePanel`, `renderPlanBadge`, etc.).

---

## 3. Backend Simulation Layer (`backend-simulation/`)

This directory houses the headless logic engine. All files are ES modules and can be imported directly into tests or UI controllers.

- `backend-simulation/storage.js`
  - **Responsibility**: LocalStorage data access layer (DAL).
  - **Key Features**: Initializes storage from JSON seed files, provides typed read/write helpers, caps request logs at 500 items via FIFO eviction, and implements safe demo data reset.
  - **Storage Keys**: `sf_session`, `sf_plans`, `sf_tenants`, `sf_requests`, `sf_daily_usage`, `sf_invoices`.

- `backend-simulation/state.js`
  - **Responsibility**: Application state getters and aggregate calculations.
  - **Key Features**: Retrieves current tenant session, calculates Estimated MRR across active tenants, and determines quota health status (`normal`, `warning`, `critical`).

- `backend-simulation/auth.js`
  - **Responsibility**: Client-side role authentication and permission guards.
  - **Key Features**: Manages session state (`role`, `tenantId`), maps roles to allowed views, and enforces route guards with `guardPage()` redirection.

- `backend-simulation/rateLimiter.js`
  - **Responsibility**: Fixed-window rate limiter implementation.
  - **Key Features**: Maintains per-tenant request counters across 60-second sliding/fixed windows, calculates `retryAfter` seconds, blocks excess traffic, and only increments counters on allowed requests.

- `backend-simulation/gateway.js`
  - **Responsibility**: Simulated API gateway request pipeline.
  - **Pipeline Steps**:
    1. Authenticate API Key (`401 Unauthorized` if invalid/missing).
    2. Enforce Per-Minute Rate Limit (`429 Too Many Requests` with `retryAfter` if exceeded).
    3. Enforce Monthly Hard Quota (`429 Too Many Requests` with quota notice if exhausted).
    4. Simulate Network Latency (200-600ms) and return `200 OK` with JSON payload.
  - **Key Features**: Adds structured request logs to `storage.js` for every attempt.

- `backend-simulation/billing.js`
  - **Responsibility**: Metered usage billing calculations and invoice state management.
  - **Key Features**: Calculates invoices in **integer paise** (1 Rupee = 100 Paise) to avoid floating-point rounding bugs; calculates overage fees using `(overageCalls / 1000) * overageRate`; handles plan change rules (immediate rate limits, next-month billing).

---

## 4. Data Layer (`data/`)

- `data/plans.json`: Defines the Free, Starter, and Pro tier rules, base fees in paise, per-minute limits, monthly quotas, and overage rates.
- `data/tenants.json`: Seed data for 7 fictional tenant companies with fake API keys, status, and baseline monthly usage.
- `data/usage.json`: 30-day historical usage record per tenant for daily chart rendering.
- `data/usage.csv`: CSV export equivalent of tenant daily usage history.

---

## 5. Documentation (`docs/`)

- `docs/README.md`: Getting started guide, tech stack overview, running instructions.
- `docs/PROJECT_STRUCTURE.md`: This file; architectural overview.
- `docs/TESTING.md`: Complete 25-point verification matrix with test evidence.
