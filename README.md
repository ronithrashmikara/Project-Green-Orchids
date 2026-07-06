<div align="center">

![Project Green — Orchids](docs/media/branding/readme-banner.jpg)

# 🌸 Orchids — Project Green

### B2B Wholesale Orchid Trade Platform

A full-stack B2B wholesale commerce platform for a Sri Lankan orchid exporter — RFQ → quote → order, tier pricing, credit & invoicing, payments, returns (RMA), delivery tracking, and a clean multi-role portal UI.

![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-000?logo=nextdotjs)
![Express](https://img.shields.io/badge/API-Express-000?logo=express)
![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791?logo=postgresql)
![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind_CSS-06B6D4?logo=tailwindcss)
[![CI](https://github.com/InfiniteBloom-max/Project-Green-Orchids/actions/workflows/ci.yml/badge.svg)](https://github.com/InfiniteBloom-max/Project-Green-Orchids/actions/workflows/ci.yml)

**[Status](#status) · [Homepage](#public-homepage) · [Catalogue](#catalogue) · [Dashboards](#dashboards) · [Features](#features) · [Getting Started](#getting-started) · [Testing](#testing) · [Demo Accounts](#demo-accounts)**

</div>

---

## Status

All 6 roles (Admin, Trade Buyer, Finance Officer, Inventory Manager, Delivery
Coordinator, and public visitor) have a working, populated portal, and all 7
core golden paths pass end-to-end with UI + API + DB verification: buyer
onboarding (register → email OTP verify → admin approval), catalogue → cart →
order → admin approve → stock reservation → invoice, RFQ → quote → accept →
convert to order, invoicing with partial/final payments to exactly PAID,
delivery assign → dispatch → in-transit → POD → buyer confirmation, RMA
return → approve → item received (real stock movement) → resolution with an
invoice credit that actually updates the invoice's balance, and a security/
audit panel (login history, session force-logout, a locked-account panel that
reflects the real lockout mechanism, audit log) with admin-decided price
governance and CMS media.

Two full strict QA passes have been run against this codebase; every bug
either pass found — 15 total — has been fixed and re-verified live (not from
code review alone):
- [`docs/qa-reports/QA_FULL_SYSTEM_TEST_REPORT_2026-07-04.md`](docs/qa-reports/QA_FULL_SYSTEM_TEST_REPORT_2026-07-04.md) — the first strict pass (5 bugs, fixed same day)
- [`docs/qa-reports/QA_FIX_VERIFICATION_2026-07-03.md`](docs/qa-reports/QA_FIX_VERIFICATION_2026-07-03.md) — the second strict pass (10 bugs, including the missing Delivery Coordinator portal, an RMA credit note that never updated its invoice, an admin lockout panel disconnected from the real lockout check, and a payment-reversal two-person rule that accepted a fabricated approver)

On top of that, a real automated test suite now backs the API: 57 `node:test`
integration tests (`npm test`) driving the actual Express app against an
isolated database, covering every module and re-asserting all 15 bugs above so
they can't silently regress. Writing those tests surfaced 8 more real bugs —
role_id validated as a UUID when the real column is a smallint (staff-user
creation was completely broken), two wrong SQL column names, a NULL-overrides-
DEFAULT bug on supplier creation, an entirely broken CMS content-block module
(wrong columns) plus a public content leak of unpublished drafts, a cart
stock-check gap on brand-new lines, a seed-script FK-order gap, and a JWT
timing race in password-change token invalidation — all fixed and now
regression-tested.

CI (GitHub Actions, badge above) runs on every push/PR to `main`/`develop`:
spins up a real Postgres service container, syntax-checks the API, builds the
web app, and runs the full test suite. Its first real run caught one more bug
no local check had: the web app shipped a `tsconfig.json` for its `@/*` import
alias despite being 100% JavaScript with no `typescript` dependency — it
resolved by local accident but failed outright on a clean checkout. Fixed with
the correct `jsconfig.json`.

**Known gaps, honestly:**
- Zero automated coverage of the frontend itself — the test suite is API/DB-only; UI regressions still need manual browser QA.
- Reports/BI, notification retry, credit monitor, and CMS content blocks are smoke-tested, not exhaustively.
- `scripts/seed.js`/`scripts/migrate.js` are idempotent, but the seeded demo dataset still accumulates whatever a session runs against it — reset with a fresh `npm run migrate && npm run seed` for a clean slate.

## Public Homepage

![Homepage](docs/media/screenshots/homepage.png)

---

## Catalogue

523 products across 14 real categories (8 orchid varieties, 3 fertilizer
types, 3 supply types), each with a real product photo — search, type/category
filters, and live stock bands, all browsable before signing in:

![Catalogue](docs/media/screenshots/catalogue.png)

### Product photography

Every product image is AI-generated (Stable Diffusion XL) from a fixed set of
70 prompts — 5 distinct photo briefs per category, covering colour, form and
packaging variety so the grid doesn't look repetitive:

![Sample catalogue photos](docs/media/screenshots/catalogue-sample-images.png)

The full prompt list lives in
[`docs/image-assets/catalogue-image-generation-prompts.md`](docs/image-assets/catalogue-image-generation-prompts.md),
and the generation pipeline — a free Colab GPU runtime running
`diffusers` + SDXL — is captured as a runnable notebook in
[`docs/image-assets/generate_catalogue_images_sdxl.ipynb`](docs/image-assets/generate_catalogue_images_sdxl.ipynb).
`scripts/seed.js` maps each product's category to one of its 5 photos
(round-robin), plus 10 flagship orchids get a specific named hero shot instead
of the generic category rotation. `scripts/backfill_product_images.js` applies
the same mapping to an already-seeded database without a destructive reseed.

---

## Dashboards

Five distinct role-based portals, each with its own dark glassmorphism theme:

### Admin Suite — Operations Dashboard
![Admin Dashboard](docs/media/screenshots/admin-dashboard.png)

### Trade Portal — Buyer Dashboard
![Buyer Dashboard](docs/media/screenshots/buyer-dashboard.png)

### Finance Desk — Financial Overview
![Finance Dashboard](docs/media/screenshots/finance-dashboard.png)

### Inventory Hub — Stock Overview
![Inventory Dashboard](docs/media/screenshots/inventory-dashboard.png)

### Delivery Centre — Coordinator Dashboard
![Delivery Dashboard](docs/media/screenshots/delivery-dashboard.png)

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
- **Testing:** Node's built-in `node:test` runner (no extra dependency), driving the real app against an isolated database
- **CI:** GitHub Actions — Postgres service container, API/web build checks, full test suite on every push/PR

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

`npm run migrate` creates the `project_green` database if it doesn't exist and runs every
migration (`apps/api/migrations/0001` through the latest — currently `0014`) in order. It
tracks what's already applied in a `schema_migrations` table, so running it again against an
existing DB is a safe no-op instead of re-running non-idempotent DDL:

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/project_green npm run migrate
```

### 3. Seed demo data

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/project_green npm run seed
```

This creates staff accounts, buyer accounts, a full orchid catalogue and sample orders. It's
safe to re-run against an already-seeded DB — it clears its own tables first (in FK-safe
order) and reseeds from scratch.

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

## Testing

```bash
npm test
```

Runs `scripts/run-tests.js`, which migrates + seeds an isolated `..._test`
database (derived from `DATABASE_URL`, never the real dev DB) and then runs
the full `node:test` integration suite (57 tests) sequentially against a real
instance of the app. No extra test framework to install. The same thing runs
in CI on every push/PR — see the badge at the top of this file, or
`.github/workflows/ci.yml`.

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
├── .github/workflows/
│   └── ci.yml                # Postgres service + build + test on every push/PR
├── apps/
│   ├── api/                  # Express REST API
│   │   ├── migrations/       # PostgreSQL migration files
│   │   └── src/
│   │       ├── modules/      # Feature modules (auth, orders, buyers, …), each with a *.test.js
│   │       └── test/         # Shared node:test harness (helpers.js)
│   └── web/                  # Next.js 14 frontend
│       └── app/
│           ├── (admin)/      # Admin portal pages
│           ├── (buyer)/      # Trade buyer portal pages
│           ├── (finance)/    # Finance desk pages
│           ├── (inventory)/  # Inventory hub pages
│           ├── (delivery)/   # Delivery coordinator pages
│           └── (public)/     # Public site (homepage, login, register)
├── scripts/
│   ├── seed.js                # Database seeder (idempotent)
│   ├── migrate.js             # Migration runner (idempotent, tracks applied files)
│   ├── run-tests.js           # Test-DB setup + node:test runner
│   └── dev-tools/             # One-off build/capture/debug scripts (not part of the app)
└── docs/
    ├── qa-reports/            # Strict QA passes + bugfix verification
    ├── snapshots/             # Dated system/session snapshots
    ├── engineering/           # DATABASE.md, CONTRIBUTING.md, devlog, implementation report
    ├── presentations/         # Gantt, use-case diagrams, defence/overview decks
    ├── media/
    │   ├── screenshots/       # README dashboard screenshots
    │   └── videos/            # Demo recordings
    └── image-assets/          # Generated/sourced catalogue image assets, legacy images
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
Built with Next.js, Express, and PostgreSQL · Orchids 2026
</div>
