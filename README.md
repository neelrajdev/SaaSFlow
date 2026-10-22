# SaaSFlow

**A Universal API Gateway & Metered Billing Console (Simulation)**

SaaSFlow is a client-side simulated API gateway that demonstrates how
enterprise platforms manage API traffic, enforce rate limits, and
automate metered billing, all while strictly maintaining data privacy.

Whether a company is serving live financial tickers, e-commerce data, or
AI models, SaaSFlow provides the infrastructure to monetize and protect
those endpoints. This project was built by Neel Raj and Divyanshu Baghel
for the PST_PD_004 OJT Track.

------------------------------------------------------------------------

## ⚠️ The Problem: Unmanaged API Infrastructure

APIs are the backbone of the modern internet. However, exposing an API
without a protective layer introduces massive risks:

1.  **Infrastructure Vulnerability:** A single buggy script from a
    client can send thousands of requests per second, instantly crashing
    the provider's backend servers.
2.  **Revenue Leakage:** Providers lack built-in tools to precisely
    meter API usage, making it nearly impossible to confidently charge
    customers for what they consume.
3.  **Access Chaos:** Managing authentication, issuing API keys, and
    enforcing plan-specific quotas (e.g., Free vs. Pro tiers) becomes a
    logistical nightmare as the user base grows.

------------------------------------------------------------------------

## 💡 The SaaSFlow Solution

SaaSFlow acts as a smart, universal "toll booth" sitting between
external developers and a company's backend infrastructure. It
standardizes the API lifecycle:

-   **The Bouncer (Authentication):** Intercepts requests and validates
    masked API keys before traffic ever touches the core servers.
-   **The Speed Limit (Rate Limiting):** Enforces strict, plan-based RPM
    (Requests Per Minute) limits in real-time. If a client exceeds their
    quota, SaaSFlow instantly blocks them with a `429 Too Many Requests`
    error, protecting backend uptime.
-   **The Cashier (Metered Billing):** Tracks every byte of data passing
    through the gateway, automatically aggregating usage to generate
    transparent, Stripe-style invoices at the end of the month.

------------------------------------------------------------------------

## ✨ Core Features

-   **🔀 Universal API Routing:** A dynamic Playground where consumers
    can simulate sending requests through the gateway and viewing the
    simulated response and data consumption.
-   **🚦 In-Browser Rate Limiting:** Tracks API keys and enforces
    subscription limits (e.g., 20 requests/min). Exceeding the limit
    triggers a dynamic `429` block with a live countdown timer.
-   **💳 Automated Billing Engine:** Automatically tracks usage per
    tenant, calculating base subscription fees plus Rupee (₹) overage
    charges for the monthly invoice.
-   **🛡️ Zero-Inspection Privacy:** The system architecture is designed
    to log only operational metadata (latency, status codes, data cost)
    while completely discarding the actual payload strings.
-   **👥 Role-Based Access (RBAC):** Three distinct views:
    -   **Founder:** High-level KPI dashboard (Total Calls, Blocked
        429s, Active MRR).
    -   **API Consumer:** Developer playground and virtual key
        management.
    -   **Finance:** Itemized usage tracking and invoice settlement.

------------------------------------------------------------------------

## 🛠️ Tech Stack (Phase 1: Simulation)

> **📝 Development Note:** The current version of SaaSFlow will use demo
> data and browser-based simulation to demonstrate its core features.
> The backend infrastructure using **Node.js, Express.js, and MongoDB**
> will be implemented in a later phase to enable real API request
> processing, persistent data storage, and backend functionality.

Because this project demonstrates architectural logic without requiring
real backend deployment, the entire gateway engine runs directly in the
browser:

-   **UI/Styling:** HTML5, CSS3, Bootstrap 5.3
-   **Core Logic:** Vanilla JavaScript (ES6)
-   **Database Simulation:** Browser `localStorage` (JSON seeding)
-   **Routing Engine:** JS Promises & `setTimeout` to mimic network
    latency.

------------------------------------------------------------------------

## 📂 Folder Structure

### Existing Frontend Simulation

``` text
SaaSFlow/
├── index.html          # Main login/entry point
├── dashboard.html      # The core UI wrapper for all roles
├── css/
│   └── styles.css      # Custom styling overrides for Bootstrap
├── js/
│   ├── gateway.js      # The simulated API routing engine & fake delays
│   ├── rateLimiter.js  # Math logic for fixed-window rate limiting
│   ├── billing.js      # Data-to-Rupee math calculations
│   └── app.js          # UI state management and DOM manipulation
└── data/
    ├── tenants.json    # Seed data for companies (ShopKart, Zomato, etc.)
    └── plans.json      # Subscription tier definitions
```

------------------------------------------------------------------------

## 💻 How to Run Locally

Since this is a client-side simulation, there are no heavy servers or
databases to spin up.

1.  **Clone the repository:**

    ``` bash
    git clone https://github.com/YourUsername/SaaSFlow.git
    ```

2.  **Navigate to the folder:**

    ``` bash
    cd SaaSFlow
    ```

3.  **Run the app:**

    Simply double-click `index.html` to open it in your web browser, or
    use a tool like VS Code Live Server for hot reloading.

------------------------------------------------------------------------

*Built with 💡 in Bengaluru, India.*
