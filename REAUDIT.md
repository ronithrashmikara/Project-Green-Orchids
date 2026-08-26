# Project Orchids — Re-Audit (Round 2)

**Date:** 2026-08-26 · **Scope:** every page, button, form, modal and API contract across all six portals + public site · **Method:** 3 static cross-check passes (web↔API contract diff, full interactive-element inventory, RBAC matrix vs migrations) + live browser QA of admin, buyer, finance, delivery and sales portals against the running stack.
**Round-1 fixes verified still green:** SKU auto-generation ✓ (UI + API), PO reference end-to-end ✓ (ORD persisted `PO-REAUDIT-005`), delivery POD upload E2E ✓ (`PATCH /deliveries/:id/pod` → 200, DELIVERED), order approve via confirm dialog ✓, sales-manager claim ✓.

---

## P0 — Buttons/flows that cannot work

### R-P0-1. Buyer "Submit RFQ" has never been submittable
- `apps/web/app/(buyer)/buyer/rfq/new/page.js:50` posts `{ lines }`; the API schema expects `{ items:[{product_id, quantity}] }` (`rfq.schema.js`) → every submit returns **422 `Unrecognized key 'lines'` / `items Required`** (reproduced live).
- Same file `:53`: redirect reads `res.data.id` (always undefined; envelope is `res.data.data.id`) → even on success it would land on `/buyer/rfq/undefined`.

### R-P0-2. Buyer dashboard RFQ links are dead 404s
- `apps/web/app/(buyer)/buyer/dashboard/page.js:130,:143` link to `/buyer/rfqs` and `/buyer/rfqs/${id}`; only `/buyer/rfq` and `/buyer/rfq/[id]` exist (verified live: blank 404 page).

### R-P0-3. Entire admin buyer-detail page calls nonexistent APIs
- `apps/web/app/(admin)/admin/buyers/[id]/page.js:31,46,55,63` call `GET/PUT /admin/buyers/:id`, `POST /admin/buyers/:id/suspend|reactivate` — none exist (real: `/buyers/...`). Even retargeted, `PUT /buyers/:id` doesn't exist — the API wants separate `PATCH /buyers/:id/tier` and `PATCH /buyers/:id/credit`, both `.strict()` requiring a `reason` field the form never collects (`buyers.schema.js`). Update Tier & Credit / Suspend / Reactivate buttons always fail. (Orphaned: no link navigates here — found only by URL.)

### R-P0-4. Admin "Create Staff" always rejected
- `apps/web/app/(admin)/admin/users/page.js:33` posts `{name,email,role:'INVENTORY_MANAGER',password}`; `createUserSchema` is `.strict()` and requires numeric `role_id` → **every submission 400s**.

### R-P0-5. Every CMS block edit fails validation
- `apps/web/app/(admin)/admin/cms/page.js:112-114,206-208,408-410` PATCH `/cms/blocks/:key` with `{key,type,content,title}` where `type` is lowercase (`'hero'`); `cms.updateSchema` is `.strict()`, has no `key`, and type enum is UPPERCASE → **all existing-block saves 422** ("Failed to save"). Creates are fine. Block delete has **no API route at all** behind either fallback path (`cms.routes.js` defines none).

### R-P0-6. Security: any authenticated user can cancel ANY order
- `PATCH /orders/:id/cancel` (`orders.routes.js:16`) has **no permission guard**; `orders.service.cancel` infers `role='ADMIN'` for anyone whose trade account isn't the buyer (`orders.service.js:254-256`) → a delivery coordinator, another buyer, any logged-in account can cancel any order and trigger reservation release/invoice voiding.

### R-P0-7. Security: buyer payment-history IDOR
- `GET /buyers/:id/payments` (`buyers.routes.js:21`) requires only `payment.view`, which TRADE_BUYER holds (`0002_roles_permissions.sql:147`), with zero ownership scoping (`buyers.service.getRelated` → repository filters purely on path param) → any buyer can read **any other buyer's payment history**.

## P1 — Broken/wrong behavior

| # | Finding | Evidence |
|---|---|---|
| R-P1-1 | Inventory "Export CSV" button → `GET /inventory/movements/export/csv` → **404** (live-confirmed). API supports `GET /inventory/movements?format=csv` | `inventory/movements/page.js:31` vs `inventory.controller.js` |
| R-P1-2 | Admin orders search box does nothing — service drops `search` param; page also fires a guaranteed-404 `GET /admin/orders` before falling back to `/orders?adminView=true` on every load/filter (live-confirmed double request) | `admin/orders/page.js:44-45`, `orders.service.js:141-145` |
| R-P1-3 | Reports date-range pickers ignored (`dateFrom/dateTo` sent; service reads `from/to`); "Export CSV" downloads a **JSON file named `.csv`** (`/reports/export` mapped to the JSON dashboard handler) | `admin/reports/page.js:29-41`, `reports.routes.js:9` |
| R-P1-4 | Admin Users table Role + Last Login columns render blank (reads `role`/`lastLoginAt`; API returns `role_name`/`last_login_at`) | `admin/users/page.js:73-75` vs `users.repository.js:8` |
| R-P1-5 | RFQ status tabs (admin + buyer) return identical unfiltered lists — `?status=` dropped by `rfq.service.list` | `rfq.service.js:27-31`, repo has no status predicate |
| R-P1-6 | Same for RMA/returns status tabs | `rma.service.js:48-52` |
| R-P1-7 | Security audit log pagination hardcoded `totalPages={10}` — pages beyond 10 unreachable | `admin/security/page.js:170` |
| R-P1-8 | Dashboard "Out-of-stock" alert link passes `?availability=OUT`; products page never reads it → unfiltered list | `admin/dashboard/page.js:169`, `admin/products/page.js:35-36` |
| R-P1-9 | Zero-stock ACTIVE products are addable to cart; failure surfaces only as raw checkout error `400 INSUFFICIENT_STOCK ... 0 available` (live-reproduced twice). Catalogue "Add" should be blocked/disabled when available ≤ MOQ | compat `PUT /cart` + catalogue card logic |
| R-P1-10 | Pending/rejected buyers keep full cart + dashboard access through compat mirror routes (`GET/PUT /cart`, `GET /me/summary` use `requireAuth` only) — defeats the approval gate the domain routers enforce | `compat.routes.js:120,150,168` vs `cart.routes.js:7` |

## P2 — Standards gaps / polish

- ProductCard out-of-stock overlay "Request via RFQ" is `<a href='#'>` — dead anchor (should be `/buyer/rfq/new`). `ProductCard.jsx:46`
- Missing enum coverage: invoice filter/badge lacks `ADJUSTED` (and badge color); badge lacks `ITEM_RECEIVED`; buyer order filter lacks `PROCESSING/READY_TO_SHIP/RETURNED`; deliveries status filter lacks `CONFIRMED`. (`buyer/invoices/page.js:63`, `StatusBadge.jsx`, `buyer/orders/page.js:24-25`, `admin/deliveries/page.js:14-21`)
- Orphan page: `/buyer/statements` works but nothing links to it (not in buyer nav).
- Contact page is information-only (mailto/tel) — no inquiry form; acceptable but unusual for B2B lead capture.
- `POST /complaints` lacks `requireApprovedBuyer` (pending buyers can open complaints). `complaints.routes.js:10`
- TRADE_BUYER holds `stock.view`, so buyers can read internal `/inventory/*` movement/alert/summary endpoints (over-grant). `0002:147` + `inventory.routes.js:7`
- Finance dashboard "Open invoices sorted by due date" panel: `sort=due_date:asc` silently ignored (`invoices.service.list` has no sort param).
- Dead permission rows (seeded but unenforced): `rfq.create/view.*, order.create/cancel, invoice.generate/download/view.own, rma.create/view.own, product.view/archive, alert.view, role.assign`.

## Corrections to scout claims (verified wrong)

- ~~"Seed creates no SALES_MANAGER"~~ — `sales1@/sales2@example.invalid` ARE seeded as SALES_MANAGER (verified in DB; README matches).
- Delivery POD flow, sales queue shape, payments/statement/complaint contracts, all auth flows, rewrite coverage, and method verbs: verified sound.

---

## Verified working (live)

Admin: dashboard metrics, orders list/filter/detail approve-with-confirm (status flipped to APPROVED), products list/add/edit tabs/duplicate, buyers queue tabs, tiers/suppliers modals, reports render all 8 views, security tabs render.
Buyer: catalogue search/filters/cards, product detail tier pricing, add-to-cart, cart qty/remove/savings, checkout → order created with PO reference persisted, order detail redirect.
Delivery: deliveries list, Mark In Transit, Mark Delivered with mandatory POD photo upload → 200 DELIVERED.
Sales: approvals queue Claim (row assigned to "You"), availability toggle present.
Public: register HTML5 validation, cookie banner actions, status page.

---

## Fix log (2026-08-26, all items above addressed unless noted)

**API (21 files + migration `0020_revoke_buyer_stock_view.sql`)**
- `GET /users/roles` added; `POST /users` accepts optional `password` (bcrypt cost 12, skips setup email) — Create Staff now works.
- `DELETE /cms/blocks/:key` added (cms.edit; audited; 404 on missing key).
- `GET /orders?search=` implemented (`order_no`/buyer business name ILIKE, pagination-aware COUNT).
- `/reports/export?format=csv` returns real text/csv via csv-stringify with Content-Disposition; `dateFrom/dateTo` accepted as aliases of `from/to`.
- Cancel authorization fixed: only the owning buyer or holders of `order.approve` may cancel (non-owner → 403 — **verified live**: delivery coordinator probe → 403).
- Payments IDOR fixed: callers without `invoice.view.all` are forced to their own trade account (**verified live**: buyer2 → buyer1 payments → 403).
- compat `/cart`, `/me/summary` and complaints POST/message routes now gated by `requireApprovedBuyer`.
- Migration 0020 revokes `stock.view` from TRADE_BUYER (closes internal inventory read leak).

**Web**
- Buyer RFQ form sends `{items:[{product_id,quantity}]}` → **201 live**, redirects to `/buyer/rfq/<id>`; RFQ detail page unwraps the `{success,data}` envelope and renders rfqNo/date/lines correctly (**verified live**: "RFQ #RFQ-000018 · Submitted: 26 Aug 2026 · SUBMITTED").
- Buyer dashboard dead links point to `/buyer/rfq`; ProductCard "Request via RFQ" links to `/buyer/rfq/new`; Add button disabled on zero availability using the API's true `available` (stock − reserved).
- Admin buyer-detail page fully rewired to real endpoints (`GET /buyers/:id`, `PATCH /buyers/:id/tier|credit` with reason inputs, suspend/reactivate) with live related-orders/invoices/payments/RMA tabs.
- Admin Users: role dropdown from `/users/roles` (role_id), password field honored, Role/Last-Login columns read correct fields.
- CMS: payloads stripped to schema shape (uppercase type, no key), all phantom `/admin/cms/*` preflight calls removed, block Delete wired to the new DELETE route.
- Admin orders single-fetch + working search box; deliveries filter gains CONFIRMED; security audit pagination uses real page count; reports date pickers use `from`/`to`; finance open-invoices sorted by due date client-side.
- Inventory movements Export CSV now calls the supported `?format=csv` endpoint.

**Regression found & fixed during verification:** the component edit for R-P1-9 accidentally dropped `Button`/`StockBand` imports from `ProductCard.jsx`, blanking every buyer catalogue card render — caught by re-running the UI pass, imports restored.

**Final state:** integration suite **64/64 green** (two fixtures de-flaked to select genuinely available products); production build compiles clean; headline flows re-verified in the browser post-fix (RFQ submit/detail, order approve confirm flow, POD upload, checkout with PO reference).

### Deliberately not changed
- `rfq.quote` remains ADMIN-only (sales desk has approvals/complaints/availability per README scope) — flagged as a product decision if sales managers should quote.
- Contact page stays information-only (no lead form) — candidate for the planned UI revamp.
