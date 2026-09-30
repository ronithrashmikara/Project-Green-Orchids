<div align="center">

<img src="docs/media/branding/banner.webp" alt="Project Green / Orchids — B2B wholesale platform, team project" width="100%">

# 🌸 Orchids — Project Green

### B2B Wholesale Orchid Trade Platform

A full-stack B2B wholesale commerce platform built by a five-person team around a hypothetical Sri Lankan orchid-exporter scenario — RFQ → quote → order, tier pricing, credit and invoicing, payments, returns (RMA), delivery tracking, sales-manager work distribution, buyer complaints, and six role-focused workspaces.

![Next.js](https://img.shields.io/badge/Next.js-15_App_Router-000?logo=nextdotjs)
![Express](https://img.shields.io/badge/API-Express-000?logo=express)
![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791?logo=postgresql)
![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind_CSS-06B6D4?logo=tailwindcss)
[![CI](https://github.com/ronithrashmikara/Project-Green-Orchids/actions/workflows/ci.yml/badge.svg)](https://github.com/ronithrashmikara/Project-Green-Orchids/actions/workflows/ci.yml)

**[Status](#status) · [Team](#team-and-contributions) · [Homepage](#public-homepage) · [Catalogue](#catalogue) · [Dashboards](#dashboards) · [Features](#features) · [Getting Started](#getting-started) · [Testing](#testing) · [Security](#security) · [Demo Accounts](#demo-accounts)**

</div>

---

## Status

**All 6 authenticated roles have a working, populated portal** — Admin, Trade
Buyer, Finance Officer, Inventory Manager, Delivery Coordinator, and Sales
Manager — and all
7 core golden paths pass end-to-end with UI + API + DB verification:

- Buyer onboarding: register → email OTP verify → admin approval
- Catalogue → cart → order → admin approve → stock reservation → invoice
- RFQ → quote → accept → convert to order
- Invoicing with partial/final payments landing exactly on PAID
- Delivery: assign → dispatch → in-transit → POD → buyer confirmation
- RMA: return → approve → item received (real stock movement) → resolution with an invoice credit that actually updates the balance
- Security/audit panel: login history, session force-logout, a locked-account panel wired to the real lockout mechanism, audit log — plus admin-decided price governance and CMS media

### QA history

Two full strict QA passes have been run against this codebase, and every bug
either one found — 15 total — has been fixed and re-verified live, not just
from code review:

- [`QA_FULL_SYSTEM_TEST_REPORT_2026-07-04.md`](docs/qa-reports/QA_FULL_SYSTEM_TEST_REPORT_2026-07-04.md) — first strict pass (5 bugs, fixed same day)
- [`QA_FIX_VERIFICATION_2026-07-03.md`](docs/qa-reports/QA_FIX_VERIFICATION_2026-07-03.md) — second strict pass (10 bugs, including the missing Delivery Coordinator portal, an RMA credit note that never touched its invoice, a locked-accounts panel disconnected from the real lockout mechanism, and a payment-reversal rule that accepted a fabricated approver)

On top of that, **69 `node:test` tests** (`npm test`) now drive the real
Express app against an isolated Postgres database and re-assert all 15 bugs
above so they can't silently regress. Most modules have their own test file;
`compat`, `complaints` and `sales` do not yet (see Known gaps).

Writing those tests surfaced **8 more real bugs**: `role_id` validated as a
UUID when the real column is a smallint (staff-user creation was completely
broken), two wrong SQL column names, a NULL-overrides-DEFAULT bug on supplier
creation, an entirely broken CMS content-block module (wrong columns) plus a
public leak of unpublished drafts, a cart stock-check gap on brand-new lines,
a seed-script FK-order gap, and a JWT timing race in password-change token
invalidation. All fixed, all regression-tested.

A later concurrency pass went looking for race conditions directly: firing
concurrent requests at order approval (2-way), RFQ-to-order conversion and
RMA approve/receive (10-way each). All three raced — double-reserved stock,
duplicate orders, duplicate credits. All three are now serialized with a
`SELECT ... FOR UPDATE` row lock on the parent row plus a status re-check and
status-conditional update inside the transaction. The lock serializes; the
re-check is what turns the loser into a clean `409`.

The race tests are stochastic (they depend on the scheduler interleaving the
requests), so two **deterministic lock tests** back them up: a second
connection holds the order row lock, and the test asserts via
`pg_blocking_pids` that the API request queues on exactly that lock, then
releases it and checks the outcome (`200` after a rollback, `409` with no
reservation or invoice after a committed status change). Multi-product stock
locks are taken `ORDER BY id`, and `tx()` retries a transaction that Postgres
aborts as a deadlock victim (`40P01`) or serialization failure (`40001`), with
its own tests that force a real deadlock.

**This isn't a claim that every bug has been found.** It's 69/69 tests green
today, with the specific things those tests check enumerated above and in
[`docs/qa-reports/`](docs/qa-reports/).

CI (GitHub Actions, badge above) runs on every push/PR to `main`/`develop`:
spins up a real Postgres service container, audits production dependencies
(`npm audit --omit=dev`), syntax-checks the API, builds the web app, and runs
the full test suite. Its first real run caught a bug no
local check had — the web app shipped a `tsconfig.json` for its `@/*` import
alias despite being 100% JavaScript with no `typescript` dependency, which
happened to resolve locally by accident but failed outright on a clean
checkout. Fixed with the correct `jsconfig.json`.

**Known gaps, honestly:**
- No dedicated test files yet for `compat`, `complaints` or `sales`.
- Zero automated coverage of the frontend itself — the test suite is API/DB-only; UI regressions still need manual browser QA.
- Reports/BI, notification retry, credit monitor, and CMS content blocks are smoke-tested, not exhaustively.
- `scripts/seed.js` / `scripts/migrate.js` are idempotent, but the seeded demo dataset accumulates whatever a session runs against it — reset with a fresh `npm run migrate && npm run seed` for a clean slate.

## Team and contributions

Project Green was a **five-person pre-industry team project** (Apr–Jul 2026).
Ronith Rashmikara was team lead and lead engineer. Figures below are measured
from this repository's `main` branch (commit `8c10778`, before the
2026-09-30 maintenance commits), merging each person's author names by email;
line shares use `git blame -w` on surviving source lines.

| Measure | Ronith | Teammates |
|---|---|---|
| Commits | 167 of 334 (50%) | Sithum Nimhan 56, Nadeera Prabhash 50, Rashandi Tharushika 31, Yasali Sarajika Edirimanna 30 |
| `apps/api` + `apps/web` surviving lines | ~62% | ~38% |
| Integration tests and `scripts/run-tests.js` | ~100% | — |
| `apps/api/migrations` (schema) | ~20% | ~80% |
| CI workflow, and the order / RFQ / RMA row-lock fixes (2026-07-06) | written by Ronith | — |

Teammates wrote most of the database schema and substantial parts of the API
and web app, including authentication and RBAC, the catalogue, supplier and
stock ledger, tier pricing, the buyer dashboard and RFQ workflow, and the
finance, invoice and RMA screens. The multi-product stock lock
(`lockProductsForUpdate`) was written by a teammate.

### How this was built

Ronith used
Claude Code as an AI pair-programmer for part of his work: 52 of his 167
commits carry a `Co-Authored-By: Claude` trailer. He reviewed every change,
and the integration tests and CI are the acceptance gate.

## Public Homepage

![Homepage](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/homepage.png)

---

## Catalogue

523 products across 14 real categories (8 orchid varieties, 3 fertilizer
types, 3 supply types), each with a real product photo — search, type/category
filters, and live stock bands, all browsable before signing in:

![Catalogue](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/catalogue.png)

### Product photography

Every product image is AI-generated (Stable Diffusion XL) from a fixed set of
70 prompts — 5 distinct photo briefs per category, covering colour, form and
packaging variety so the grid doesn't look repetitive:

![Sample catalogue photos](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/catalogue-sample-images.png)

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

Six distinct role-based portals, each with its own dark glassmorphism theme:

### Admin Suite — Operations Dashboard
![Admin Dashboard](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/admin-dashboard.png)

### Trade Portal — Buyer Dashboard
![Buyer Dashboard](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/buyer-dashboard.png)

### Finance Desk — Financial Overview
![Finance Dashboard](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/finance-dashboard.png)

### Inventory Hub — Stock Overview
![Inventory Dashboard](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/inventory-dashboard.png)

### Delivery Centre — Coordinator Dashboard
![Delivery Dashboard](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/delivery-dashboard.png)

### Sales Desk — Approvals, Complaints & Team Availability

Sales managers can mark themselves Available or Away, claim or process order
approvals, manage buyer complaint conversations, reassign work, and see team
workload. New pending orders and complaints are automatically routed to the
available manager with the lightest workload.

---

## System Status

A public `/status` page ([`apps/web/app/(public)/status/page.js`](apps/web/app/\(public\)/status/page.js)) polls the
same-origin `/api/healthz` endpoint every 30 seconds. The Next.js rewrite sends
that request to the Express API, whose health check runs `SELECT 1` against
PostgreSQL. The page reports the live web and aggregate API/database status and
latency — no fabricated uptime history, just what is reachable right now:

| All systems operational | Live outage detection |
|---|---|
| ![Status — operational](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/status-operational.png) | ![Status — outage](https://raw.githubusercontent.com/ronithrashmikara/Project-Green-Orchids/main/docs/media/screenshots/status-outage.png) |

The outage screenshot is a real capture taken with the API process killed — the page correctly flips the API to
"Major outage" and the Database to "Unknown" (it can't be checked independently of the API), then recovers on its
own once the API comes back on the next poll.

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
| **Sales Desk** | Available/Away presence, order approval queue, complaint threads, reassignment, team workload, and least-busy auto-assignment |
| **Buyer complaints** | Category, priority, optional order reference, status tracking, and two-way messaging with the assigned sales manager |
| **Reporting & BI** | 8-view dashboard — sales trend, category performance, top products, buyer behaviour, credit risk, inventory turnover, supplier contribution, returns analytics |
| **CMS** | Admin-editable homepage content blocks + a media library (image upload/list/delete) |
| **Security & Audit** | Login history, active-session listing with force-logout, locked-account unlock, audit log explorer, access-window settings |
| **Public marketing pages** | About, Contact, Pricing, Trade Terms, Help Centre, Privacy, Terms of Service |
| **Cookie consent** | Accept/reject/manage preferences, Necessary/Analytics/Marketing controls, 180-day first-party preference storage, and a public cookie policy |
| **System Status** | Public `/status` page, live-polls web/API/database health off the real `/healthz` check, no fake uptime history |
| **RBAC** | 6 roles (Admin, Trade Buyer, Finance Officer, Inventory Manager, Delivery Coordinator, Sales Manager) with granular, DB-driven permissions |

---

## Tech Stack

- **Frontend:** Next.js 15 App Router, React 19, Tailwind CSS
- **Backend:** Express.js REST API, modular architecture
- **Database:** PostgreSQL with full relational schema (migrations in `apps/api/migrations/`)
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing
- **Emails:** Nodemailer (email verification, password reset)
- **Testing:** Node's built-in `node:test` runner (no extra dependency), driving the real app against an isolated database
- **CI:** GitHub Actions — Postgres service container, API/web build checks, full test suite on every push/PR

---

## Getting Started

### Prerequisites

- Node.js **22.12+** (pinned via `"engines"` in `package.json`; the test runner passes a glob to `node --test`, which older Node versions do not expand; CI runs on Node 22)
- PostgreSQL **14+** (CI runs against `postgres:16`; developed against 18 locally — any 14+ works, the schema uses no version-specific features)
- (Optional) pnpm / npm

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

`npm run migrate` creates the `project_green` database if it doesn't exist and runs every
migration (`apps/api/migrations/0001` through the latest — currently `0016`) in order. It
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
the full `node:test` suite (69 tests) sequentially against a real
instance of the app. No extra test framework to install. The same thing runs
in CI on every push/PR — see the badge at the top of this file, or
`.github/workflows/ci.yml`.

CI also audits production dependencies. CodeQL scans JavaScript/TypeScript and
GitHub Actions, while Dependabot and secret scanning monitor the repository.

---

## Security

Please do not disclose suspected vulnerabilities in a public issue. Use
GitHub's private vulnerability reporting flow described in
[`SECURITY.md`](SECURITY.md). The policy explains the supported version, what
details to include, and how reports are handled.

---

## Demo Accounts

After seeding, log in at `http://localhost:3000/login`:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.invalid` | `Staff@1234` |
| Finance Officer | `finance@example.invalid` | `Staff@1234` |
| Inventory Manager | `inventory@example.invalid` | `Staff@1234` |
| Delivery Coordinator | `delivery@example.invalid` | `Staff@1234` |
| Sales Manager (Available) | `sales1@example.invalid` | `Staff@1234` |
| Sales Manager | `sales2@example.invalid` | `Staff@1234` |
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
│   └── web/                  # Next.js 15 frontend
│       └── app/
│           ├── (admin)/      # Admin portal pages
│           ├── (buyer)/      # Trade buyer portal pages
│           ├── (finance)/    # Finance desk pages
│           ├── (inventory)/  # Inventory hub pages
│           ├── (delivery)/   # Delivery coordinator pages
│           ├── (sales)/      # Sales Desk, complaints, approvals, availability
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
`complaints`, `security`, `cms`, `notifications`, `compat`.

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
| Sales Manager | `/sales` |

---

<div align="center">
Built with Next.js, Express, and PostgreSQL · Orchids 2026
</div>
