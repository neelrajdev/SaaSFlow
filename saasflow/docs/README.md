# SaaSFlow: Simulated API Usage, Rate-Limiting & Billing Dashboard

Welcome to **SaaSFlow**! This is a browser-based simulation of a modern API management, rate limiting, and metered billing platform.

---

## 1. What is SaaSFlow?

SaaSFlow is a simulated developer platform and dashboard designed to show how real API platforms (like Stripe, Twilio, or AWS API Gateway) handle:
- **Tenant Management**: Managing API keys and subscriptions for client companies.
- **Rate Limiting**: Enforcing requests-per-minute limits using a fixed-window algorithm.
- **Usage Tracking**: Keeping track of daily and monthly API consumption.
- **Metered Billing & Invoicing**: Calculating base fees, included quotas, and overage charges without floating-point math issues.

Everything runs **completely in the browser** using client-side technologies (HTML5, CSS3, Vanilla ES Modules, and `localStorage`). There is no actual backend server or database to install.

---

## 2. The Three User Roles

SaaSFlow simulates three distinct perspectives:

1. **Founder (Platform Owner)**
   - Monitors overall system health, total API calls, successful vs. blocked requests, and Estimated MRR (Monthly Recurring Revenue).
   - Manages tenant accounts and upgrades or downgrades their subscription tiers.
   - Has read-only visibility into billing metrics.

2. **API Consumer (Tenant Developer / Client)**
   - Views their own company's credentials (masked API key with copy button).
   - Monitors their live per-minute rate limits and monthly quota consumption.
   - Tests simulated API endpoints in an interactive **Playground** to observe `200 OK`, `401 Unauthorized`, and `429 Too Many Requests` responses.
   - **Crucial Rule:** Cannot view or access any other tenant's data or keys.

3. **Finance (Billing Administrator)**
   - Reviews monthly generated invoices across all tenants.
   - Analyzes base subscription fees vs. usage-based overage charges.
   - Marks invoices as `Paid` or tracks `Unpaid` receivables.
   - Cannot modify tenant subscription plans.

---

## 3. The Ten Application Screens

| Screen ID | Screen Name | File Path | Primary Audience | Description |
|---|---|---|---|---|
| **S1** | Demo Login | `frontend/index.html` | All | Role picker (Founder, Consumer with tenant select, Finance) and demo data reset. |
| **S2** | Overview | `frontend/pages/overview.html` | Founder | High-level KPI cards, top tenants by usage, quota progress, and recent activity. |
| **S3** | Tenants | `frontend/pages/tenants.html` | Founder | Searchable tenant table showing current plan, usage bars, quota %, and status. |
| **S4** | Tenant Detail | `frontend/pages/tenant-detail.html` | Founder | In-depth tenant view, 7-day usage chart, request history, and plan modification. |
| **S5** | My API | `frontend/pages/my-api.html` | Consumer | Tenant-scoped credentials, per-minute usage, monthly quota bars, quick playground link. |
| **S6** | Playground | `frontend/pages/playground.html` | Consumer / Founder | Live API simulator testing `200`, `401`, `429` (per-minute & monthly quota) with countdown. |
| **S7** | Billing | `frontend/pages/billing.html` | Finance / Founder | Monthly invoice summary, billing totals, outstanding amounts, and invoice list. |
| **S8** | Invoice Detail | `frontend/pages/invoice-detail.html` | Finance | Line-item invoice breakdown (base fee, overage calculations, subtotal, mark as paid). |
| **S9** | Plans | `frontend/pages/plans.html` | All | Comparison grid of Free, Starter, and Pro tiers with quotas, limits, and rates. |
| **S10** | Access Denied | `frontend/pages/access-denied.html` | All | Guard screen shown when a user directly navigates to a forbidden URL for their role. |

---

## 4. Technology Stack & Constraints

To keep the application educational, robust, and beginner-friendly, the stack is strictly constrained:

- **Frontend UI**: Standard HTML5, CSS3, and **Bootstrap 5.3** loaded via CDN.
- **JavaScript**: 100% Vanilla JavaScript utilizing modern **ES Modules** (`import` / `export`).
- **Data Persistence**: Browser `localStorage` seeded from static `.json` files.
- **Zero Heavy Frameworks**: No React, Next.js, Vue, Angular, or bundlers required.
- **Zero Backend Servers**: No Node.js, Express, Python, or external databases.

---

## 5. Project Folder Structure

```text
saasflow/
│
├── frontend/                     # Presentation layer only
│   ├── index.html                # S1: Entry point & demo login
│   ├── pages/                    # S2 - S10: Inner HTML pages
│   │   ├── overview.html         # S2: Founder dashboard
│   │   ├── tenants.html          # S3: Tenant management
│   │   ├── tenant-detail.html    # S4: Tenant details & plan upgrades
│   │   ├── my-api.html           # S5: Consumer credentials & limits
│   │   ├── playground.html       # S6: Interactive API simulator
│   │   ├── billing.html          # S7: Invoices overview
│   │   ├── invoice-detail.html   # S8: Line-item breakdown
│   │   ├── plans.html            # S9: Plan comparison grid
│   │   └── access-denied.html    # S10: Unauthorized route guard
│   │
│   ├── css/
│   │   └── styles.css            # Custom CSS custom properties, responsive rules
│   │
│   └── js/
│       ├── app.js                # Shell orchestrator, navigation & toast helpers
│       ├── components.js         # Shared reusable UI component functions
│       └── pages/                # Page-specific view controllers
│           ├── login.js
│           ├── overview.js
│           ├── tenants.js
│           ├── tenant-detail.js
│           ├── my-api.js
│           ├── playground.js
│           ├── billing.js
│           ├── invoice-detail.js
│           ├── plans.js
│           └── access-denied.js
│
├── backend-simulation/           # Business logic & simulation engine
│   ├── storage.js                # LocalStorage management, JSON seed loader & FIFO caps
│   ├── state.js                  # Clean state accessors & computed getters (e.g., MRR)
│   ├── auth.js                   # Client-side session management & route guard rules
│   ├── rateLimiter.js            # Fixed-window per-minute rate limiting algorithm
│   ├── gateway.js                # API Gateway pipeline (Auth -> Rate -> Quota -> 200)
│   └── billing.js                # Integer paise currency & metered overage calculations
│
├── data/                         # Seed data files
│   ├── plans.json                # Tier definitions (Free, Starter, Pro)
│   ├── tenants.json              # Sample tenant companies & fake API keys
│   ├── usage.json                # 30-day historical usage data per tenant
│   └── usage.csv                 # Tabular export representation of usage history
│
├── docs/                         # Documentation and testing
│   ├── README.md                 # Primary system guide
│   ├── PROJECT_STRUCTURE.md      # Detailed file & module responsibilities
│   └── TESTING.md                # 25-point acceptance criteria test results
│
└── .gitignore                    # Standard ignored files
```

---

## 6. How Frontend Files Communicate with Backend Simulation Modules

SaaSFlow strictly separates the **Presentation Layer** (`frontend/`) from the **Simulation Engine** (`backend-simulation/`).

### Communication Flow:
1. When a user opens any page (e.g., `frontend/pages/playground.html`), the browser loads the page's controller (`frontend/js/pages/playground.js`) as an ES module using `<script type="module">`.
2. The page controller imports simulation functions directly:
   ```javascript
   // Example inside frontend/js/pages/playground.js
   import { handleRequest } from '../../backend-simulation/gateway.js';
   import { getCurrentSession } from '../../backend-simulation/auth.js';
   import { renderResponsePanel } from '../components.js';
   ```
3. When the user interacts with the UI (such as clicking "Send Request"):
   - The UI script reads form inputs.
   - It invokes `handleRequest(apiKey, endpoint, now)`.
   - The simulation module executes business logic (key verification, window rate limiting, monthly quota check, latency simulation).
   - The simulation returns a structured result object: `{ httpStatus, body, responseTime, rateLimitInfo }`.
   - The UI script passes this result to `renderResponsePanel()` in `components.js` to update the DOM.
4. **No HTML file or UI script ever calculates billing formulas, performs rate-limit checking, or writes raw localStorage keys directly.** All business logic is encapsulated in `backend-simulation/`.

---

## 7. How to Run the Application Using VS Code Live Server

Because SaaSFlow uses native JavaScript ES Modules (`import` and `export`) and loads seed files via `fetch()`, the browser requires a local HTTP web server (running directly via `file:///` causes browser CORS restrictions on module scripts and local JSON files).

### Step-by-Step Instructions:

1. **Open VS Code**:
   Open the root project folder `saasflow/` in VS Code (`File` -> `Open Folder...`).
2. **Install Live Server**:
   Go to the Extensions marketplace (`Ctrl+Shift+X` or `Cmd+Shift+X`), search for **Live Server** (by Ritwick Dey), and click **Install**.
3. **Launch the Server**:
   - In the VS Code file explorer, right-click on `frontend/index.html`.
   - Select **"Open with Live Server"** (or click **Go Live** on the bottom status bar).
4. **Open in Browser**:
   Your default browser will automatically open:
   ```text
   http://127.0.0.1:5500/frontend/index.html
   ```
5. **Alternative (Python Built-in Server)**:
   If you do not have VS Code Live Server installed, you can open PowerShell / Terminal in the `saasflow/` folder and run:
   ```bash
   python -m http.server 8000
   ```
   Then navigate in your browser to `http://localhost:8000/frontend/index.html`.


---

## 8. Step-by-Step User Journey Demonstrations

### Journey A: Founder Identifies & Upgrades a Tenant
1. Open `frontend/index.html`. Select the **Founder** persona and click **Enter Dashboard**.
2. Inspect the executive dashboard on `frontend/pages/overview.html`.
3. Locate the yellow **90% Quota Alert Banner** at the top of the screen.
4. Click **Details** next to tenant **PayEasy** (Starter tier).
5. In `frontend/pages/tenant-detail.html`, inspect PayEasy's 7-day usage chart and masked key.
6. Under **Subscription Tier Management**, select **Pro Tier** and click **Apply Subscription Change**.
7. Confirm that the per-minute limit increases to **60 req/min** immediately, and a success toast confirms the update.

### Journey B: Consumer Hits 429 Rate Limiting in Playground
1. Open `frontend/index.html`. Select **API Consumer** and choose tenant **WeatherNow** (Free tier).
2. On `frontend/pages/my-api.html`, click **Copy Key** to verify your credential, then click **Launch Playground**.
3. In `frontend/pages/playground.html`, click **Trigger 5 Rapid Calls**.
4. The first 5 requests succeed with `200 OK`.
5. Submit a 6th request immediately. Observe:
   - Response code switches to **429 Too Many Requests**.
   - An accessible countdown timer starts counting down (e.g., `58s`, `57s`...).
   - The Send Request button is disabled during throttling.
   - Screen readers announce: *"Rate limit reached. Retrying allowed in Xs."*
6. When the countdown completes, the button is re-enabled. Submit again and receive `200 OK`.

### Journey C: Finance Audits and Settles an Invoice
1. Open `frontend/index.html`. Select the **Finance** persona and click **Enter Dashboard**.
2. On `frontend/pages/billing.html`, review billing totals for **October 2026**.
3. Locate invoice `INV-PAYEASY-2026-10` in the table (marked **Unpaid**).
4. Click **Inspect** to navigate to `frontend/pages/invoice-detail.html`.
5. Verify line items: Base Fee ₹999.00 + Overage (11,250 calls @ ₹40/1k) ₹450.00 = **Total ₹1,449.00**.
6. Click **Mark as Paid**. Status changes to **Paid ✓**.
7. Refresh the browser (`F5`). Verify the status remains **Paid** and the button remains disabled.

---

## 9. How to Deploy to GitHub Pages or Vercel

### Option 1: GitHub Pages
1. Push your repository to GitHub.
2. In your GitHub repository, navigate to **Settings** -> **Pages**.
3. Under **Build and deployment**, select **Source** as **Deploy from a branch**.
4. Select branch `main` and folder `/` (root), then click **Save**.
5. Create a root `index.html` redirect if you want visitors to automatically land on `frontend/index.html`:
   ```html
   <!DOCTYPE html>
   <html>
     <head>
       <meta http-equiv="refresh" content="0; url=frontend/index.html" />
     </head>
   </html>
   ```
6. Your static site will be live at `https://<your-username>.github.io/<repo-name>/frontend/index.html`.

### Option 2: Vercel
1. Install Vercel CLI (`npm i -g vercel`) or import the GitHub repository in the Vercel dashboard.
2. In the project root, create a `vercel.json` file:
   ```json
   {
     "rewrites": [
       { "source": "/", "destination": "/frontend/index.html" }
     ]
   }
   ```
3. Run `vercel --prod` to deploy in seconds. Zero backend servers or environment variables required!
