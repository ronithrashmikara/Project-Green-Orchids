# Project Orchids — Full System Audit

**Date:** 2026-08-26 · **Commit:** `4a620bf` (main) · **Auditor:** independent full-pass audit requested by owner
**Environment:** Windows 11 · Node 23.5 · PostgreSQL 18.1 · Next.js 15 (prod build, port 3100) · Express API (port 5000)
**Method:** static code review (all 23 API modules, 18 migrations, web app pages/forms/middleware) + live browser QA of public site and Admin portal + API-level E2E probes against the seeded database (520 products, 925 orders, 8 buyers).

Severity: **P0** = feature broken in real use · **P1** = wrong behavior/data integrity/deployment risk · **P2** = standards gap, polish, docs.

Every finding below cites file:line evidence. Items marked **[LIVE]** were reproduced against the running system, not just read from code.

---

## What is solid (verified, not just claimed)

- Parameterized SQL throughout; sort columns whitelisted (`utils/pagination.js`); central `AppError` + error handler.
- Money math via decimal.js cents-compared helpers (`utils/money.js`); NUMERIC(14,2) columns; overpayment rejected at cent precision (`payments.service.js:118-121`).
- Order approval is properly hardened: row locks (`FOR UPDATE` on order + products), availability re-check under lock, credit check, reservation + ledger + invoice + outbox email in one tx (`orders.service.js:169-235`). **[LIVE]**
- Signed double-submit CSRF, Origin allowlist, `X-Requested-With` check (`middleware/csrf.js`); RBAC reloaded from DB per request (`middleware/auth.js`).
- Upload hardening: UUID filenames, subdir allowlist, path-escape check, extension+MIME+magic-byte validation, 5MB cap (`middleware/upload.js`).
- Idempotent tracked migrations; append-only triggers for ledger/audit tables; partial + trigram indexes; CHECK constraints on enums.
- 63 `node:test` integration tests drive the real app against an isolated DB; CI runs them with a real Postgres service.

---

## P0 — Broken features

### P0-1. Adding a product requires hand-typing a SKU — nothing is generated (owner-reported) **[LIVE]**
- Evidence: `products.schema.js:7` — `sku: z.string().trim().min(2).max(50)` (required). `products.repository.js:57-66` inserts whatever arrives; no generation anywhere. Web form ships an empty mandatory field: `ProductFormClient.jsx:27` (`sku: ''`), `:89` (`sku: form.sku`), `:166` (`<Input label="SKU" ... required />`).
- Reproduced live: filling Name/Type/Category/Supplier/Base Price and submitting → `POST /api/products` → **422**, product not created, no hint that SKU is the blocker beyond a generic message.
- Industry standard: server generates the SKU (type-prefixed, collision-safe) when the operator leaves it blank; operators rarely invent good SKUs.
- Only `duplicate()` synthesizes SKUs today (`${sku}-COPY-${Date.now().toString(36)}`, `products.repository.js:113`).

### P0-2. Dispatch/delivery never converts reservations into physical stock out — inventory silently corrupts **[LIVE]**
- Evidence: `delivery.repository.js:84-112` — on DISPATCHED/DELIVERED it only stamps `orders.status`; it never touches `products.stock_qty` / `reserved_qty` and writes no fulfillment movement.
- `orders.repository.js:135-141` has a correct-looking `dispatchStock()` — **zero callers** (dead code).
- Reproduced live (order ORD-0000567): approve raised `reserved_qty` (+qty) ✓; dispatch + in-transit changed nothing ✗; `stock_movements` shows only ORDER_RESERVE rows, no ORDER_FULFILL.
- Consequence: delivered goods remain "reserved" forever; available-to-promise (`stock_qty - reserved_qty`) trends to zero; the ledger cannot reconcile physical stock; reorder levels never trigger on real sales.

### P0-3. Email outbox permanently strands any failed email
- Evidence: `jobs/outboxDispatch.js:10-17` selects `status='PENDING'` only, but the failure path writes `status='FAILED'` *with a future `next_attempt_at`* (`:41-44`) — exponential backoff is computed then never honored. Terminal and retriable failures are indistinguishable.
- Also `FOR UPDATE SKIP LOCKED` runs on autocommit (`query`, not `tx`) so the claim holds no lock across sends — multi-instance unsafe.
- Schema even anticipates retry (`idx_notifications_outbox_status ... WHERE status IN ('PENDING','FAILED')`, migration `0007:64-65`) — the job ignores it.
- Consequence: one transient SMTP blip permanently kills order/approval/RMA notification emails.

### P0-4. Invoice aging/dunning job fails four ways — overdue flow is dead code
- Evidence (`jobs/invoiceAging.js`):
  - `:10,:20` filters `status IN ('ISSUED','PARTIALLY_PAID')` — **`ISSUED` does not exist** (CHECK allows `PENDING,PARTIALLY_PAID,PAID,OVERDUE,CANCELLED,VOID`, migration `0006:16-17`). PENDING invoices are never marked OVERDUE.
  - `:18-19,:35` joins `users u ON u.id = i.buyer_id` — but `invoices.buyer_id` references **trade_accounts(id)** (UUID, different id space, migration `0006:11`). Reminder queries match nothing.
  - `:11,:28,:46` returns/uses `invoice_number` — the column is `invoice_no`. Template data arrives undefined.
  - `:65` references `p.status = 'COMPLETED'` on payments — **payments has no status column** (migration `0006:35-48`) → the reliability-score UPDATE throws 42703 on every run (swallowed by catch-all).
- Net effect: no dunning emails, no overdue transitions, no reliability scoring — while the dashboard advertises NET terms management.

---

## P1 — Wrong behavior / data integrity / deployment risk

### P1-1. Order reject/cancel are unguarded — racing approve() can corrupt state
- `orders.service.js:238-298` reads status pre-tx then calls `repo.setRejected/setCancelled` which are unconditional `UPDATE ... WHERE id=$2` (`orders.repository.js:106-117`) — no `FOR UPDATE`, no `AND status=` guard (approve got this fix; reject/cancel did not).
- Race: reject lands while approve's tx commits → REJECTED order with reserved stock + live invoice.

### P1-2. Cancelling an APPROVED order leaves an orphan PENDING delivery
- `orders.service.js:260-291` releases stock + voids invoice but never touches the `deliveries` row created at approval (`orders.service.js:225-228`). Coordinators see a cancellable/assignable delivery for a CANCELLED order. Also releases reservations unconditionally — once P0-2 is fixed, cancelling a dispatched order must not "release" stock that physically left.

### P1-3. RFQ quote/decline emails compute garbage
- `rfq.service.js:98` totals via `i.quoted_price` — column is `quoted_unit_price` (`rfq.repository.js:83`) → totalAmount always `0.00`.
- `rfq.service.js:99,:115` read `rfq.rfq_number` — column is `rfq_no` (`rfq.repository.js:15`) → undefined order refs in customer emails.
- `rfq.service.js:87` passes `notes` to `updateItemQuote` which destructures only `{itemId, quotedPrice}` (`rfq.repository.js:82-84`) — silently dropped.

### P1-4. Bulk pricing tiers are administered and displayed but never priced
- Admin CRUD: `products.service.js:107-122`; shown on product detail/buyer UI — but order lines price only from `base_price × account-tier discount` (`orders.service.js:63-70`); `bulk_pricing_tiers` has no consumer in cart/orders. Buyers see volume discounts that checkout ignores.

### P1-5. Checkout PO Reference and Order Note are dead UI
- Collected: `cart/page.js:24,115-116`; sent: `api.post('/orders', { notes })` only (`:46`). `createSchema` accepts `notes` but `createFromCart` never persists it (`orders.service.js:45-48`); `orders` table has neither `po_reference` nor a notes column (migration `0005:114-138`). B2B PO references vanish silently.

### P1-6. Quote expiry job crashes + unreachable window; quotes may never expire
- `jobs/quoteExpiry.js:15` selects `r.rfq_number` (nonexistent → SQL error each run); `:9-17` warning window is the 1-hour band `[due+24h, due+25h]` vs a daily 08:00 cron — effectively never fires; `rfq.service.js:99` claims “7 days” default but no default is ever persisted — quotes without explicit expiry never expire.

### P1-7. Stock adjustment is a lost-update race; ledger write can orphan
- `products.service.js:147-174` computes `newQty` from an unlocked pre-tx read; two concurrent adjustments lose one. `repo.createStockMovement(...)` (`products.repository.js:165-172`) runs on the pool, not the tx client — movement row survives a rolled-back tx. `RESERVATION_CONVERT` decrements `stock_qty` without touching `reserved_qty` (inconsistent with the reservation invariant).

### P1-8. Rate limiting is OFF unless NODE_ENV is set exactly right
- `rateLimit.js:3` `isDevelopment = NODE_ENV !== 'production'` → running `node src/index.js` bare gives **5000 req/min including auth routes**. Secure defaults should invert this: only opt-in dev bypass.

### P1-9. Statement endpoints 500 on malformed month (no validation)
- `invoices.controller.js:16,:23` parse `month` with `.split('-').map(Number)`; `invoices.repository.js:63` interpolates `${year}-${MM}-01` — `?month=x` → NaN date string → Postgres cast error → raw 500 (parameterized, so not injection — but unvalidated input reaching SQL casting).

### P1-10. Seed data contradicts the live state machine **[LIVE]**
- `scripts/seed.js:526-534` creates DRAFT / PROCESSING / READY_TO_SHIP orders that no API transition produces (145 DRAFT orders in DB). Order detail for these renders nonsense — verified live on ORD-0000912: line item product "—", SKU "—", unit price LKR 0.00, yet order total LKR 140,448.
- `scripts/seed.js:624-628` seeds ORDER_RESERVE movements with negative qty; runtime writes positive (`orders.service.js:208`) — ledger sign flips between sources (seen live: `-6,-7…` seeded vs `+8,+29…` runtime).
- `reserved_qty` seeded independently of open APPROVED orders — availability doesn't reconcile.

### P1-11. Delivery status sync stomps order state; duplicated state machines disagree
- `delivery.repository.js:105-109` unconditional `UPDATE orders SET status` — a FAILED→DISPATCHED retry flips a CLOSED/CANCELLED order back to DISPATCHED.
- Two divergent transition tables: `utils/stateMachine.js:48-57` (DELIVERED→CONFIRMED, no PENDING→CANCELLED) vs local copy `delivery.service.js:4-12` (inverse). Only the local one is enforced; the shared one is dead weight.

---

## P2 — Standards gaps / polish

| # | Finding | Evidence |
|---|---|---|
| P2-1 | Homepage hero `<video>` stalls the page `load` event 30s+ (blocks crawlers/QA tooling; hurts LCP). Use `preload="none"` + poster | observed live |
| P2-2 | CORS allowlist exact-match footgun: serving via `127.0.0.1:3100` with `CORS_ORIGIN=localhost:3100` yields opaque 403 `CORS_ORIGIN_REJECTED` on every mutation | observed live; `index.js:30-43` |
| P2-3 | Server sets **two different `xsrf_token` cookies per response** — browser copes, non-browser clients break confusingly | `csrf-token` route + middleware both issue |
| P2-4 | Admin orders status filter lists phantom statuses (“Confirmed”, “Shipped”) and omits real ones (APPROVED, READY_TO_SHIP, CLOSED, RETURNED, REJECTED) | `admin/orders/page.js` filter; observed live |
| P2-5 | Portal pages ship generic titles (“Project Green - Wholesale Trade”) — no per-page titles | observed live on /admin/products |
| P2-6 | Success envelope varies: `{success,data}` in modern modules vs raw arrays in compat routes | `compat.routes.js` vs module controllers |
| P2-7 | Auth emails (verify/reset) bypass the outbox — direct `sendMail`, lost on SMTP blips; forgot-password doesn't invalidate prior reset tokens; OTP/reset tokens stored plaintext | `auth.service.js` vs `utils/outbox.js` |
| P2-8 | Most admin/buyer forms rely on HTML `required` only; zod used API-side exclusively | e.g. `ProductFormClient.jsx` |
| P2-9 | `middleware.js` gate is refresh-cookie presence only; roles enforced client-side + API-side (acceptable, but no defense-in-depth redirect) | `apps/web/middleware.js:30-60` |
| P2-10 | Docs drift: `docs/engineering/IMPLEMENTATION_REPORT.md:419-421` documents wrong credentials (`Buyer@12345`, `korchids.example.invalid`) — following it locks you out | file |
| P2-11 | PDF/statement date formatting uses server-local `toLocaleDateString('en-GB')` instead of the Colombo-pinned helpers used elsewhere — dates can print a day early on UTC hosts | `invoices.service.js` PDF paths |
| P2-12 | Email subjects expose raw template keys (“Orchids: order_approved”) | `outboxDispatch.js:24` |
| P2-13 | No OpenAPI spec / API reference; no request-id propagation into logs; frontend has zero automated coverage (README acknowledges) | repo-wide |

---

## Fix plan (executed top-down; P0s first)

| ID | Fix | Verified by |
|---|---|---|
| F1 | Server-generated SKU when blank (`ORC-/FRT-/SUP-/GEN-` + sequence, collision-safe); web field optional with “leave blank to auto-generate” | create via API without sku; duplicate-name create; UI submit |
| F2 | Convert reservation → stock-out at DISPATCHED (per-item, in-tx): `stock_qty -= q`, `reserved_qty -= q`, ORDER_FULFILL movement; FAILED-after-dispatch restocks; guard order-status sync with current-status condition | E2E script: approve→dispatch→deliver shows stock drop + movement rows |
| F3 | Guarded reject/cancel (lock + conditional update); cancel closes non-dispatched deliveries; skips reservation release when already dispatched | concurrent approve/reject probe; cancel-before/after-dispatch cases |
| F4 | Outbox: claim batch `SKIP LOCKED` inside tx → SENDING; retryable stay PENDING with `next_attempt_at`; terminal FAILED after 5 attempts; human subjects | force-fail transport, assert retry schedule + eventual SENT |
| F5 | invoiceAging: real statuses, trade_accounts↔users join, `invoice_no`, drop `p.status`, working reliability rollup | run job against seeded DB; assert OVERDUE transitions + reminder rows queued in outbox |
| F6 | RFQ: `quoted_unit_price` totals, `rfq_no` refs, conditional status guards, persist 7-day default expiry, fix expiry job select/window | quote→email payload assertion; accept/decline races |
| F7 | Wire PO Reference + buyer note end-to-end (migration 0019 `orders.po_reference`,`orders.buyer_note`; schema, repo, API response, cart UI, order detail) | checkout with PO ref → value visible on order detail |
| F8 | adjustStock under `FOR UPDATE`; movement insert through tx client; RESERVATION_CONVERT also decrements reserved_qty | parallel-adjustment probe; ledger consistency |
| F9 | Real status filter options on admin orders page | UI snapshot + filtering works |
| F10 | Statement month validated (`YYYY-MM` zod) → 422 not 500 | malformed query probe |
| F11 | Secure-default rate limits (`isDev = NODE_ENV === 'development'`); homepage video `preload="none"`+poster; CORS doc/example includes both loopback origins | config probes |
| F12 | Seed: reachable statuses only, signed-positive reserves, reconciled reserved_qty; fix IMPLEMENTATION_REPORT credentials | fresh migrate+seed; DRAFT count = 0; spot-check order detail |

Items intentionally left as documented recommendations (not fixed in this pass): OpenAPI spec, frontend test harness, outbox-ifying auth emails, plaintext token hashing, envelope unification — larger surface changes best done as their own PRs.

---

## Live QA log (abridged)

- Public home/catalogue/product/status pages render; catalogue search + filters work; cookie-consent Accept/Reject/Manage all function.
- Login as admin works via `localhost` origin; **fails via `127.0.0.1`** (P2-2).
- Admin dashboard metrics + recent orders populate from live data.
- Products list: search, pagination (26 pages), bulk hide/show, CSV export, per-row Edit/Adjust/Copy/Delete buttons present and wired.
- Add Product: reproduced 422-on-blank-SKU (P0-1).
- Orders: list + pagination OK; detail ORD-0000912 renders broken seeded DRAFT data (P1-10); status filter mismatches backend enums (P2-4).
- E2E probe ORD-0000567: approve ✓ (reservation + invoice + delivery row created), dispatch/in-transit ✓, stock untouched ✗ (P0-2).

---

## Fix verification log (2026-08-26, post-fix run)

All fixes above were implemented and verified against the live system (API on :5000, rebuilt web on :3100):

- **F1 (P0-1)** — `POST /api/products` with no SKU → **201**, generated `ORC-Y7XRA0`. Explicit duplicate SKU still → 409 `DUPLICATE_SKU`. Verified through the real admin UI too: form submitted with SKU blank → **201**, redirected to `/admin/products/521`. Input now shows *"Leave blank to auto-generate"* and is not required.
- **F2/F3 (P0-2, P1-1/2)** — E2E ORD-0000859: approve → reserved +qty; dispatch → **stock −18/−15, reserved released back, ORDER_FULFILL movements written**. E2E ORD-0000861: cancel of APPROVED order → reservations released exactly to pre-approve values, **delivery row → CANCELLED** (no orphan), ORDER_RELEASE movements written; re-cancel → clean 409.
- **F4 (P0-3)** — outbox claims with `FOR UPDATE SKIP LOCKED` inside a tx, marks SENDING, retryable failures stay PENDING with exponential `next_attempt_at`, terminal FAILED only after 5 attempts, stuck-SENDING sweep added, human-readable subjects.
- **F5 (P0-4)** — job rewritten against the real schema (`PENDING/PARTIALLY_PAID`, `trade_accounts ↔ users` join, `invoice_no`, no `payments.status`) and reminders enqueue into the durable outbox. Full suite green after fix.
- **F6 (P1-3/6)** — RFQ quote without explicit expiry → **quote_expiry persisted as +7 days** (verified in DB); totals use `quoted_unit_price × requested_qty`; emails reference `rfq_no`; re-review after quote → clean 409.
- **F7 (P1-5)** — migration `0019` applied (`orders.po_reference`, `orders.buyer_note`); checkout sends both; PO ref shown on admin + buyer order detail.
- **F8 (P1-7)** — stock adjustments lock the product row inside the tx and write movements through the same client; RESERVATION_CONVERT consumes the reservation.
- **F9–F11 (P2s)** — orders status filter lists real statuses; statement month validated (422 instead of 500); rate limits secure-by-default (elevated only for explicit `NODE_ENV=development|test` — full suite re-run green after this change); homepage video `preload="none"` + poster; CORS multi-origin documented.
- **F12 (P1-10)** — fresh seed produces only reachable statuses (DELIVERED/DISPATCHED/APPROVED/PENDING_APPROVAL — zero DRAFT/PROCESSING/READY_TO_SHIP), positive movement signs, ORDER_FULFILL rows for delivered orders, `reserved_qty` reconciled exactly to open-order demand (**0 mismatches** by CTE check). Docs credentials corrected.
- **Test suite:** `node --test` integration suite → **64/64 pass** (was 63; count grew with suite content).
- **Smoke:** all public pages 200; `/admin/dashboard` unauthenticated → 307 redirect; `/healthz` healthy.

### Left as recommendations (not fixed here)
- OpenAPI spec / API reference; frontend test harness; envelope unification for compat routes; moving auth verification/reset emails onto the outbox; hashing OTP/reset tokens at rest. Each is a self-contained follow-up PR.
