<div align="center">

# 🌸 ORCHIDS — Project Green

### B2B Wholesale Orchid Trade Platform

A full-stack B2B wholesale commerce platform for a Sri Lankan orchid exporter — RFQ → quote → order, tier pricing, credit & invoicing, payments, returns (RMA), delivery tracking, and a clean multi-role portal UI.

![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-000?logo=nextdotjs)
![Express](https://img.shields.io/badge/API-Express-000?logo=express)
![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791?logo=postgresql)
![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind_CSS-06B6D4?logo=tailwindcss)

</div>

---

## Status

All core B2B workflows are implemented and verified end-to-end: buyer onboarding
(register → email OTP verify → admin approval), catalogue → cart → order →
stock reservation, RFQ → quote → convert to order, invoicing with partial
payments to exactly PAID, RMA returns with real stock movements, buyer tiers,
inventory, business-intelligence reporting, CMS (including a media library),
and a full security/audit panel (login history, session force-logout,
locked-account unlock, audit log). See
[`docs/SYSTEM-SNAPSHOT-2026-07-02-2200.md`](docs/SYSTEM-SNAPSHOT-2026-07-02-2200.md)
for the latest detailed session report — what was fixed, what was verified live,
and what's still open (frontend regex validation, type-to-confirm dialogs,
catalogue image assets).

## Public Homepage

![Homepage](docs/screenshots/homepage.png)

---

## Dashboards

Four distinct role-based portals, each with a clean slate-900 sidebar and white content area:

### Admin Suite — Operations Dashboard
![Admin Dashboard](docs/screenshots/admin-dashboard.png)

### Trade Portal — Buyer Dashboard
![Buyer Dashboard](docs/screenshots/buyer-dashboard.png)

### Finance Desk — Financial Overview
![Finance Dashboard](docs/screenshots/finance-dashboard.png)

### Inventory Hub — Stock Overview
![Inventory Dashboard](docs/screenshots/inventory-dashboard.png)

---

## Features

| Module | Capabilities |
|---|---|
| **Catalogue** | 500+ orchid SKUs, categories, supplier links, images, tier pricing, admin create/edit with bulk pricing tiers |
| **RFQ → Quote** | Buyers submit requests, admin reviews & quotes, buyer accepts and converts to a real order |
| **Orders** | Full lifecycle: PENDING_APPROVAL → APPROVED → DISPATCHED → DELIVERED, with transaction-safe stock reservation |
| **Buyer Tiers & Credit** | Silver/Gold/Platinum tiers, per-buyer credit limits, NET-30/45/60 terms, buyer approval workflow |
| **Invoicing & Payments** | Invoice generation, partial payment recording, payment reversal, statements & aging report |
| **RMA / Returns** | Return request → admin approval → item received (real stock movement) → resolution with invoice credit |
| **Delivery** | Delivery coordinator portal, dispatch/in-transit/delivered tracking, POD upload |
| **Inventory** | Stock dashboard, movement ledger, low-stock/dead-stock alerts, product workspace |
| **Reporting & BI** | 8-view dashboard — sales trend, category performance, top products, buyer behaviour, credit risk, inventory turnover, supplier contribution, returns analytics |
| **CMS** | Admin-editable homepage content blocks + a media library (image upload/list/delete) |
| **Security & Audit** | Login history, active-session listing with force-logout, locked-account unlock, audit log explorer, access-window settings |
| **Public marketing pages** | About, Contact, Pricing, Trade Terms, Help Centre, Privacy, Terms of Service |
| **RBAC** | 5 roles (Admin, Trade Buyer, Finance Officer, Inventory Manager, Delivery Coordinator) with granular, DB-driven permissions |

---

## Tech Stack

- **Frontend:** Next.js 14 App Router, React, Tailwind CSS
- **Backend:** Express.js REST API, modular architecture
- **Database:** PostgreSQL with full relational schema (migrations in `apps/api/migrations/`)
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing
- **Emails:** Nodemailer (email verification, password reset)

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally
- (Optional) pnpm / npm

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

Create a database named `project_green` and run every migration in order (numbered, `apps/api/migrations/0001` through the latest — currently `0014`):

```bash
psql -U postgres -c "CREATE DATABASE project_green;"
for f in apps/api/migrations/*.sql; do
  psql -U postgres -d project_green -f "$f"
done
```

### 3. Seed demo data

```bash
node scripts/seed.js
```

This creates staff accounts, buyer accounts, a full orchid catalogue and sample orders.

### 4. Configure environment

Copy and edit the API env file:

```bash
cp apps/api/.env.example apps/api/.env
```

Key variables:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/project_green
PORT=5000
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
CORS_ORIGIN=http://localhost:3000

# Optional — without these, emails just log to the console in dev
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail-address
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=your-gmail-address
```

### 5. Start the servers

**API (Express):**
```bash
cd apps/api
node src/index.js
```

**Frontend (Next.js):**
```bash
cd apps/web
NODE_OPTIONS=--max-old-space-size=4096 npx next build
npx next start -p 3000
```

---

## Demo Accounts

After seeding, log in at `http://localhost:3000/login`:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.invalid` | `Staff@1234` |
| Finance Officer | `finance@example.invalid` | `Staff@1234` |
| Inventory Manager | `inventory@example.invalid` | `Staff@1234` |
| Delivery Coordinator | `delivery@example.invalid` | `Staff@1234` |
| Trade Buyer | `buyer1@example.invalid` … `buyer8@example.invalid` | `Buyer@1234` |

> Note: `buyer@example.invalid` (no number) is seeded as a staff-style account and uses `Staff@1234`, not `Buyer@1234` — the numbered `buyer1`–`buyer8` accounts are the real trade buyers.

---

## Project Structure

```
project-green/
├── apps/
│   ├── api/                  # Express REST API
│   │   ├── migrations/       # PostgreSQL migration files
│   │   └── src/
│   │       └── modules/      # Feature modules (auth, orders, buyers, …)
│   └── web/                  # Next.js 14 frontend
│       └── app/
│           ├── (admin)/      # Admin portal pages
│           ├── (buyer)/      # Trade buyer portal pages
│           ├── (finance)/    # Finance desk pages
│           ├── (inventory)/  # Inventory hub pages
│           ├── (delivery)/   # Delivery coordinator pages
│           └── (public)/     # Public site (homepage, login, register)
├── scripts/
│   └── seed.js               # Database seeder
└── docs/                     # Documentation, snapshots & screenshots
```

Backend modules live under `apps/api/src/modules/` — each follows the same
`routes → controller → service → repository (+ schema)` shape: `auth`, `users`,
`buyers`, `suppliers`, `products`, `pricing`, `tiers`, `rfq`, `cart`, `orders`,
`invoices`, `payments`, `finance`, `rma`, `delivery`, `inventory`, `reports`,
`security`, `cms`, `notifications`, `compat`.

---

## Portal Access

Each role logs in to their own workspace:

| Role | Portal URL |
|---|---|
| Admin | `/admin/dashboard` |
| Trade Buyer | `/buyer/dashboard` |
| Finance Officer | `/finance/dashboard` |
| Inventory Manager | `/inventory/dashboard` |
| Delivery Coordinator | `/delivery/dashboard` |

---

<div align="center">
Built with Next.js, Express, and PostgreSQL · ORCHIDS 2026
</div>
