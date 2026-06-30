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
| **Catalogue** | 500+ orchid SKUs, categories, supplier links, images, tier pricing |
| **RFQ → Quote** | Buyers submit requests, admin quotes, converts to order on acceptance |
| **Orders** | Full lifecycle: PENDING → CONFIRMED → ALLOCATED → DISPATCHED → DELIVERED |
| **Credit & Invoicing** | Per-buyer credit limits, NET-15/30/45/60 terms, invoice generation |
| **Payments** | Record incoming payments, auto-reconcile to invoices |
| **RMA / Returns** | Return merchandise authorisation with reason tracking |
| **Delivery** | Delivery coordinator portal, track dispatched orders |
| **CMS** | Admin-editable public homepage — hero, features, testimonials |
| **RBAC** | 5 roles (Admin, Trade Buyer, Finance Officer, Inventory Manager, Delivery Coordinator) with granular permissions |

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

Create a database named `project_green` and run the migrations:

```bash
psql -U postgres -c "CREATE DATABASE project_green;"
psql -U postgres -d project_green -f apps/api/migrations/0001_extensions.sql
psql -U postgres -d project_green -f apps/api/migrations/0002_roles_permissions.sql
psql -U postgres -d project_green -f apps/api/migrations/0003_users_auth.sql
psql -U postgres -d project_green -f apps/api/migrations/0004_trade_catalogue.sql
psql -U postgres -d project_green -f apps/api/migrations/0005_pricing_rfq_cart_orders.sql
psql -U postgres -d project_green -f apps/api/migrations/0006_invoices_payments_rma_delivery.sql
psql -U postgres -d project_green -f apps/api/migrations/0007_crosscutting.sql
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
| Trade Buyer | `buyer@example.invalid` | `Buyer@1234` |
| Finance Officer | `finance@example.invalid` | `Staff@1234` |
| Inventory Manager | `inventory@example.invalid` | `Staff@1234` |
| Delivery Coordinator | `delivery@example.invalid` | `Staff@1234` |

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
└── docs/                     # Documentation & screenshots
```

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
