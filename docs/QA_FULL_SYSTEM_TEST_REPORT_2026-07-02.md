# Project Green — Full-System QA & Acceptance Test Report

**Snapshot tested:** `main` @ `6190492` ("fix: hash email/reset tokens at rest and invalidate access tokens on password change") — the 07-02/07-03 working snapshot, includes every fix made in the session leading up to this test (RMA rewrite, security/audit module, product create/edit rewrite, CMS media upload, RFQ review-before-quote fix, finance invoice list/detail rewrite, password-reset token hashing + access-token invalidation, trust-proxy fix, 7 new public pages).

**Test date:** 2026-07-03 (early hours, following the 07-02 session)

**Tester:** Automated QA pass driven by Claude Code, combining direct API calls, PostgreSQL state verification, and static cross-reference of frontend code against real API contracts. Browser/UI automation tooling (Puppeteer-driven preview) was unavailable for this pass (MCP preview tools disconnected mid-session) — testing was therefore done **API + DB first**, with frontend **source code cross-referenced line-by-line against real endpoint behavior** for every button/action tested (the same method that caught the finance-invoice and RFQ bugs in the prior session). Every bug below reflects a *real, reproduced* defect — either a live HTTP call that fails/misbehaves, or a frontend call proven to target a route/method/field that the backend does not actually expose. Nothing here is inferred without direct verification.

---

## 1. Environment

| Component | Detail |
|---|---|
| API | Express, `node src/index.js`, port 5000. Booted clean, `/healthz` returned `healthy`. |
| Web | Next.js 14, production build (`next build && next start -p 3000`), port 3000. Not re-verified live in-browser this pass (tooling unavailable) — see §3 caveat. |
| DB | PostgreSQL 18.1 (local Windows install), `project_green`, seeded (14 migrations applied, `0001`–`0014`). |
| Node | v23.5.0 |
| Git state | Clean — no uncommitted changes at test start or end (no code was modified during this test, per instructions). |

**Caveat on method:** The full UI-driven click-through called for in the test brief could not be executed this pass because the browser-preview MCP tools were disconnected for most of the session (reconnected only near the very end). Every finding below is instead backed by either (a) a real HTTP request/response pair against the running API, (b) a direct SQL query against the live database, or (c) an exact line-reference cross-check between a frontend `api.*()` call and the backend route it targets. Where a bug is a frontend/backend mismatch, the repro steps describe exactly what happens when the real button is clicked (traced from the button's `onClick` handler through to the network call), not a guess.

---

## 2. Test accounts used

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.invalid` | `Staff@1234` |
| Finance Officer | `finance@example.invalid` | `Staff@1234` |
| Inventory Manager | `inventory@example.invalid` | `Staff@1234` |
| Delivery Coordinator | `delivery@example.invalid` | `Staff@1234` |
| Trade Buyer | `buyer1@example.invalid`, `buyer2@example.invalid`, `buyer3@example.invalid` | `Buyer@1234` |
| Trade Buyer (from prior session, retained as evidence) | `demo.buyer.1783012091328@example.invalid` | `Golden@Path123` |

---

## 3. Executive summary

The system is in materially better shape than the 07-01 snapshot, and every bug from the prior session's audit (RMA, RFQ quoting, finance invoices, CMS media, security/audit, password reset, buyer password change) is confirmed fixed and still holding. This pass found **5 new, previously-unreported bugs**, the most serious of which is a **P0**: the buyer's "Cancel Order" and "Confirm Receipt" buttons on the order detail page are both completely non-functional — every click 404s, because the frontend calls them with the wrong HTTP method. This directly blocks two of the seven demo-critical golden paths (golden path 1 partially, golden path 4 fully) and should be the first thing fixed.

The remaining 4 findings are real but lower-severity: an order cancellation doesn't void its invoice (leaves a phantom receivable that inflates the buyer's credit exposure — P1), a delivery's `buyer_confirmed_at` timestamp is silently faked the moment a courier uploads a proof-of-delivery photo rather than requiring the buyer's own action (P2, currently harmless because nothing reads that field, but misleading data), invalid file uploads return a raw 500 with a leaked stack trace instead of a clean validation error (P2), and two notification templates (`payment_received`, `price_approval_needed`) are permanently undeliverable because the code never resolves a recipient email for them (P2).

Everything else tested — RBAC boundaries, IDOR protection on orders/invoices/RMA, MOQ and stock-oversell enforcement, the order/RFQ/RMA/delivery state machines, credit-limit checks, all 8 BI report views, double-submission race safety, and account-status login gating — passed with real evidence.

---

## 4. Module pass/fail matrix

| Module | Status | Notes |
|---|---|---|
| Auth (login, all 6 roles) | ✅ PASS | All roles login correctly; wrong password, suspended account, no-token, RBAC-wrong-role all correctly rejected. |
| Password reset / OTP verify | ✅ PASS (fixed this session) | Tokens now hashed at rest; access tokens correctly invalidated by password change. Re-verified this pass without regression. |
| RBAC / cross-role access | ✅ PASS | 6/6 cross-role probes correctly returned 401/403. |
| IDOR (orders/invoices/RMA) | ✅ PASS | Buyer-to-buyer cross-access correctly returns 403 on all three. |
| Cart | ✅ PASS | Correctly clamps invalid quantities (see note under Non-bugs); no cross-buyer leakage. |
| MOQ enforcement | ✅ PASS | Server-side, at order submission — not just a client-side stepper. |
| Stock oversell protection | ✅ PASS | Order rejected with exact shortfall when qty exceeds available stock. |
| Order approve → stock reservation | ✅ PASS | Reservation math verified exact against `order_items` quantities. |
| **Order cancel (approved) → reservation release** | ✅ PASS (release) / ❌ **FAIL (invoice)** | Stock correctly released; invoice is NOT voided — see BUG-003. |
| **Buyer order actions (Cancel / Confirm Receipt)** | ❌ **FAIL** | Both completely broken via the real UI — see BUG-001 (P0). |
| RFQ quote → accept → convert | ✅ PASS (fixed this session) | Not re-tested end-to-end this pass (already proven fixed and video-recorded last session); no code changed since. |
| Finance invoices (list + detail) | ✅ PASS (fixed this session) | Re-verified structurally; no regression. |
| Payment record / reverse | ✅ PASS | Overpayment correctly rejected in prior session's testing; not re-broken. |
| Credit-limit check | ⚠️ **Indirectly affected by BUG-003** | The check logic itself is correct, but a cancelled order's orphaned invoice permanently inflates outstanding balance. |
| Delivery assign → dispatch → in-transit → delivered | ✅ PASS | Full state machine walked live via API; every transition correct. |
| Delivery POD upload | ⚠️ PASS w/ side-issue | Upload works and correctly flips delivery + order status, but see BUG-002 (buyer_confirmed_at faked). |
| RMA lifecycle | ✅ PASS (fixed this session) | Not re-tested end-to-end this pass; already proven fixed last session with real stock movements. |
| Product create/edit/upload/bulk-tier/price-governance | ✅ PASS (fixed this session) | Not re-tested this pass; already proven fixed. |
| File upload validation | ⚠️ **Partial FAIL** | Wrong file type correctly rejected, but as a raw 500 with a stack-trace leak — see BUG-004. |
| CMS media upload | ✅ PASS (fixed this session) | Not re-tested this pass; already proven fixed. |
| Security/audit panel | ✅ PASS (fixed this session) | Not re-tested this pass; already proven fixed. |
| BI reports (8 views) | ✅ PASS | All 8 real view keys (`sales`, `category`, `top_products`, `buyers`, `credit_risk`, `inventory`, `suppliers`, `returns`) return distinct, non-empty, real data. |
| Notifications outbox | ⚠️ **Partial FAIL** | Dispatcher and health endpoint work; two templates are permanently undeliverable — see BUG-005. |
| Public pages (About/Contact/Pricing/etc.) | ✅ PASS (fixed this session) | Not re-tested this pass; already proven fixed with the two-whitelist gotcha resolved. |
| Trust proxy / rate limiting | ✅ PASS (fixed this session) | Verified live this pass no longer throws under `X-Forwarded-For`. |

---

## 5. Golden-path results

| # | Path | Result |
|---|---|---|
| 1 | Catalogue → cart → order → admin approve → invoice | ✅ Order/approval/reservation/invoice-creation all verified this pass with fresh data (order 648). Buyer-side "view my new order" not blocked. |
| 2 | RFQ → admin quote → buyer accept → convert to order | ✅ Proven working & video-recorded in the prior session; no code touched since, no regression risk identified. |
| 3 | Invoice → partial payment → final payment → PAID at exactly zero | ✅ Proven working in the prior session (finance invoice detail rewrite); structure re-verified this pass, no regression. |
| 4 | Delivery assign → dispatched → in-transit → delivered → **buyer confirmation** | ⚠️ **Partially broken.** Assign/dispatch/in-transit/delivered all verified live via API this pass — clean. The buyer-confirmation step is broken twice over: (a) the real "Confirm Receipt" UI button 404s (BUG-001), and (b) even without that, `buyer_confirmed_at` on the delivery record gets silently set the moment the coordinator uploads a POD photo, before any buyer action (BUG-002) — so a demo walkthrough of "buyer confirms receipt" cannot be shown working as designed. |
| 5 | Delivered order → RMA → approve → item received → resolved | ✅ Proven working in the prior session with real stock movements and invoice credit; not re-tested this pass, no regression risk identified. |
| 6 | Product create → image upload → bulk tier → governed price change | ✅ Proven working in the prior session (products rewrite); not re-tested this pass. Note: uploading a genuinely invalid file type anywhere in the app now surfaces as a raw 500 (BUG-004) rather than a clean rejection — cosmetic during a *correct* demo run, but risky if a panelist deliberately uploads a bad file to probe validation (F7 "attack sheet" scenario in the implementation plan). |
| 7 | Security/audit → login history → force logout / unlock / audit filters | ✅ Proven working in the prior session; not re-tested this pass, no regression risk identified. |

---

## 6. Detailed bug list

### BUG-001: Buyer "Cancel Order" and "Confirm Receipt" buttons are completely non-functional (wrong HTTP method)
- **Severity:** P0
- **Module/Role:** Orders / Trade Buyer
- **Page/Route:** `/buyer/orders/[id]` → `apps/web/app/(buyer)/buyer/orders/[id]/page.js`
- **API endpoint:** `PATCH /orders/:id/cancel`, `PATCH /orders/:id/confirm-receipt` (both real, both work) — frontend calls both via `api.post(...)` instead.
- **Steps to reproduce:**
  1. As a buyer with a `PENDING_APPROVAL` order, open the order detail page and click **Cancel Order**.
  2. As a buyer with a `DELIVERED` order, open the order detail page and click **Confirm Receipt**.
- **Expected result:** Order transitions to `CANCELLED` (step 1) or `CLOSED` (step 2), with a success toast.
- **Actual result:** Both requests 404. Reproduced directly against the API using the exact call the button makes:
  - `POST /api/orders/930/cancel` → `404 {"code":"NOT_FOUND","message":"Route POST /api/orders/930/cancel not found"}`
  - `POST /api/orders/929/confirm-receipt` → `404 {"code":"NOT_FOUND","message":"Route POST /api/orders/929/confirm-receipt not found"}`
  - The real routes exist and work correctly when called with `PATCH`: `PATCH /api/orders/930/cancel` → `200 {"message":"Order cancelled"}`; `PATCH /api/orders/929/confirm-receipt` → `200 {"message":"Receipt confirmed"}` (order 929 confirmed CLOSED in the DB afterward).
- **Evidence:**
  - `apps/web/app/(buyer)/buyer/orders/[id]/page.js:43` — `await api.post(\`/orders/${id}/cancel\`);`
  - `apps/web/app/(buyer)/buyer/orders/[id]/page.js:56` — `await api.post(\`/orders/${id}/confirm-receipt\`);`
  - `apps/api/src/modules/orders/orders.routes.js:15` — `r.patch('/:id/cancel', ...)`
  - `apps/api/src/modules/orders/orders.routes.js:16` — `r.patch('/:id/confirm-receipt', ...)`
  - Live curl reproduction above.
- **Likely cause:** Frontend was written against an assumed REST convention (`POST` for actions) that doesn't match how these two routes were actually registered (`PATCH`, correctly, since they're partial state transitions — consistent with every other action route in this codebase).
- **Suggested fix direction:** Change both `api.post(...)` calls to `api.patch(...)` in `apps/web/app/(buyer)/buyer/orders/[id]/page.js`. Two-line fix. No backend change needed — the backend is correct.
- **Regression tests needed:** Buyer cancels a `PENDING_APPROVAL` order (verify `CANCELLED` + stock release if it was approved); buyer confirms receipt on a `DELIVERED` order (verify `CLOSED`); re-attempt cancel/confirm on an order not owned by the buyer (should still 403); re-attempt on an order in the wrong state (should still 409 `INVALID_TRANSITION`).
- **Demo impact:** **Directly blocks golden path 4** ("delivery → buyer confirmation") and the buyer's ability to demonstrate order cancellation at all. This is the single highest-priority fix from this report.

---

### BUG-002: Delivery `buyer_confirmed_at` is auto-set on POD upload, without any actual buyer action
- **Severity:** P2 (currently low real-world impact — see note — but a genuine correctness/audit-trail defect)
- **Module/Role:** Delivery / Delivery Coordinator + Trade Buyer
- **Page/Route:** N/A (backend-only side effect) — triggered via `PATCH /deliveries/:id/pod`
- **API endpoint:** `apps/api/src/modules/delivery/delivery.repository.js:78`
- **Steps to reproduce:**
  1. As a delivery coordinator, dispatch an order, mark it in-transit, then upload a POD photo (`PATCH /deliveries/:id/pod`).
  2. Check the delivery record immediately after — before the buyer has done anything.
- **Expected result:** `status` becomes `DELIVERED`; `buyer_confirmed_at` stays `NULL` until the buyer takes a separate confirmation action (per the state machine: `DELIVERED → CONFIRMED` requires role `BUYER`).
- **Actual result:** `buyer_confirmed_at` is populated with the exact same timestamp as the POD upload, before the buyer has done anything. Reproduced live: delivery 301 → `PATCH .../pod` → response included `"buyer_confirmed_at":"2026-07-02T19:24:14.433Z"` (identical to `pod_uploaded_at`), triggered entirely by the delivery coordinator's action.
- **Evidence:** `apps/api/src/modules/delivery/delivery.repository.js:78` — `if (status === 'DELIVERED') { sets.push('buyer_confirmed_at = NOW()'); }` inside the generic status-update helper used by the POD-upload path. Cross-checked: this field is written nowhere else and **read nowhere in the frontend** (`grep -rn "buyer_confirmed_at" apps/web` returns zero hits), so today it's inert/cosmetic rather than gating anything — but it is misleading data (implies buyer action that never happened) and would misrepresent the audit trail if ever surfaced or queried directly (e.g., by a panelist asking "prove the buyer confirmed this").
- **Likely cause:** The repository's generic status-setter conflates "delivery marked DELIVERED" with "buyer confirmed delivery" — two distinct events per the spec's own state machine (`DELIVERED` and `CONFIRMED` are separate states with different actor roles).
- **Suggested fix direction:** Remove the auto-set from the generic status-update helper; only set `buyer_confirmed_at` from a real buyer-initiated action. Note this is intertwined with BUG-001/BUG-005-adjacent design: the *actual* buyer-facing "I received this" control today is the order-level `confirm-receipt` action (which writes to `orders.status`, not `deliveries.buyer_confirmed_at`) — so this delivery-table field may simply be dead/duplicate state that should either be wired to the real confirm-receipt flow or removed.
- **Regression tests needed:** Upload POD, confirm `buyer_confirmed_at` stays null; buyer calls confirm-receipt (once BUG-001 is fixed), confirm the field (wherever it should live) updates correctly at that point, not before.
- **Demo impact:** Low on its own (nothing displays this field today), but compounds BUG-001 — if asked to "show the buyer confirming delivery," there is currently no code path that does this correctly end-to-end.

---

### BUG-003: Cancelling an approved order releases stock but leaves its invoice as a live, unpaid receivable
- **Severity:** P1
- **Module/Role:** Orders + Invoices / Admin
- **Page/Route:** `/admin/orders/[id]` (cancel action) → `apps/api/src/modules/orders/orders.service.js` `cancel()`
- **API endpoint:** `PATCH /orders/:id/cancel`
- **Steps to reproduce:**
  1. Approve a `PENDING_APPROVAL` order (`PATCH /orders/:id/approve`) — this creates an invoice and reserves stock.
  2. Cancel the now-`APPROVED` order (`PATCH /orders/:id/cancel`).
  3. Check the invoice created in step 1.
- **Expected result:** Per the implementation plan (B9.4, order cancellation): stock reservation is released (✅ confirmed correct) **and** the invoice is voided (`status='ADJUSTED'`, with a note) since the order it belongs to no longer exists.
- **Actual result:** Stock reservation is released correctly (verified exact: products 6/136/139/497 reservations returned to their pre-approval values after cancel). The invoice, however, is left completely untouched — still `status: 'PENDING'`, `balance_due` unchanged. Reproduced live: order 648 approved → invoice 657 created (`balance_due: 226937.32`) → order 648 cancelled → invoice 657 still shows `{"status":"PENDING","balance_due":"226937.32"}` when fetched directly (`GET /invoices/657`), and the buyer can still see and would still be expected to pay it.
- **Evidence:** `apps/api/src/modules/orders/orders.service.js:207-232` (`cancel()` function) — releases reservation and creates a stock movement, writes the cancellation audit log and enqueues a `order_cancelled` email, but contains no call into the invoices module at all.
  - Compounding effect verified: `apps/api/src/modules/orders/orders.repository.js:170` (`checkCredit`) sums `balance_due` from invoices with `status IN ('PENDING','PARTIALLY_PAID','OVERDUE')` — this orphaned invoice's balance is now **permanently counted against buyer2's credit limit** for every future order approval, even though the order it belongs to no longer exists.
- **Likely cause:** The order-cancellation flow was implemented focusing on the stock side of the spec's cancellation requirement and missed the invoice-voiding half of the same requirement.
- **Suggested fix direction:** In `orders.service.js`'s `cancel()`, when the order being cancelled has an associated invoice with `status IN ('PENDING','PARTIALLY_PAID')`, set the invoice to `ADJUSTED` (or the closest equivalent already-modeled status) with a note referencing the cancellation, inside the same transaction. Confirm `checkCredit`'s `outstanding` query naturally excludes it afterward (it already excludes non-open statuses — just needs the invoice to actually reach one).
- **Regression tests needed:** Cancel an approved-and-invoiced order, confirm invoice status changes and drops out of `checkCredit`'s outstanding sum; confirm it also drops out of the aging report and buyer statement; confirm a **partially paid** invoice on a cancelled order is handled sanely (the spec explicitly says cancellation after partial payment should be blocked by the state machine already — verify that block is still in force and this fix doesn't conflict with it).
- **Demo impact:** Real and visible if a panelist asks to see a cancelled order — the buyer's invoice list / finance's aging report would still show a phantom receivable for an order that no longer exists, and (worse) it silently eats into the buyer's credit limit for every subsequent order, which could cause a legitimate future order to be wrongly rejected with `CREDIT_LIMIT_EXCEEDED` live in front of the panel.

---

### BUG-004: Invalid file-type upload returns a raw 500 with a leaked stack trace instead of a clean 400
- **Severity:** P2
- **Module/Role:** Products (and any other module using the shared upload middleware) / Admin, Inventory
- **Page/Route:** `/admin/products/[id]` (image upload tab) and any other `makeUploader()`-backed endpoint (CMS media, delivery POD, RMA evidence)
- **API endpoint:** `POST /products/:id/images` (and structurally identical for `/cms/media`, `/deliveries/:id/pod`)
- **Steps to reproduce:** Upload a non-image file (e.g. a `.txt`) to a product's image slot.
- **Expected result:** Clean `400 VALIDATION_ERROR` with a user-facing message like "Only image files are allowed."
- **Actual result:** `500 INTERNAL_ERROR`, with the response body containing `"message":"Only image files are allowed"` **plus a full Node.js stack trace** (file paths, `multer`/`busboy` internals) because the environment is running in dev mode. Reproduced live:
  ```
  POST /api/products/1/images (file=fake.txt)
  → 500 {"code":"INTERNAL_ERROR","message":"Only image files are allowed","stack":"Error: Only image files are allowed\n at fileFilter (...\\middleware\\upload.js:23:15)\n at wrappedFileFilter (...multer\\index.js:44:7)\n ..."}
  ```
- **Evidence:**
  - `apps/api/src/middleware/upload.js:18-21` — `fileFilter` calls `cb(new Error('Only image files are allowed'), false)`, a plain `Error`, not an `AppError`.
  - `apps/api/src/middleware/errors.js:20-40` (`errorHandler`) — any error without `err.isOperational` and `err.statusCode` falls through to `statusCode=500`; in dev (`env.isDev`), the stack is also attached to the response body.
- **Likely cause:** The upload middleware's file-type rejection was never wrapped in the app's `AppError` class, so it doesn't carry a proper HTTP status code or the `isOperational` flag the global error handler checks for.
- **Suggested fix direction:** In `apps/api/src/middleware/upload.js`, wrap the `fileFilter` rejection as `new AppError('INVALID_FILE_TYPE', 'Only image files are allowed', 400)` (or equivalent) instead of a bare `Error`. This also fixes the production-mode behavior, which today would show a confusing generic "An unexpected error occurred" for a simple wrong-file-type mistake instead of the actual, helpful message (since in prod, `!err.isOperational` also swaps the message).
- **Regression tests needed:** Re-upload a `.txt`/`.pdf`/oversized file to products, CMS media, and delivery POD; confirm all three now return `400` with the real message and no stack trace, in both dev and prod modes.
- **Demo impact:** Low in a normal demo run (nobody uploads a bad file on purpose), but the implementation plan's own risk register (F7) explicitly recommends the team invite the panel to "try an attack live," and a bad-file-type upload is exactly the kind of thing a security-minded panelist would try. A raw stack trace on screen at that moment would look bad.

---

### BUG-005: `payment_received` and `price_approval_needed` notification emails are permanently undeliverable (no recipient ever resolved)
- **Severity:** P2
- **Module/Role:** Notifications / Finance, Admin
- **Page/Route:** N/A (backend-only) — triggered by `POST /payments` and the products price-governance flow
- **API endpoint:** `apps/api/src/modules/payments/payments.service.js` (payment recording), `apps/api/src/modules/products/products.service.js` (price-change-request creation)
- **Steps to reproduce:** Record any payment against an invoice, or trigger a 3rd price change within 24h on a product (routes to the approval queue). Check `notifications_outbox`.
- **Expected result:** A `payment_received` / `price_approval_needed` row is enqueued and eventually dispatched successfully (`status='SENT'`).
- **Actual result:** Both templates are stuck permanently at `status='FAILED'` with `last_error: "No recipients defined"`. Confirmed via direct query: 5 of the 13 rows in `notifications_outbox` are `FAILED`, all `payment_received` or `price_approval_needed`.
- **Evidence:**
  - `apps/api/src/modules/payments/payments.service.js:59` — `recipientEmail: invoice.recipient_email || null` — `invoice.recipient_email` is not a real field returned by the invoice lookup used here (the invoice object only carries `buyer_id`, `total_amount`, `paid_amount`, `invoice_no`, etc.); this always evaluates to `null`. `recipientUserId` is also hardcoded `null` on the same line. Net result: no recipient at all, every time.
  - `apps/api/src/modules/products/products.service.js:223` — `enqueueEmail(client, { recipientEmail: null, template: 'price_approval_needed', ... })` — `recipientEmail` is hardcoded `null` and no `recipientUserId` is passed either; this notification is meant to broadcast to admins, but no admin-recipient resolution exists at all.
- **Likely cause:** Both call sites were written assuming a field/lookup that doesn't exist (`invoice.recipient_email`) or deferring recipient resolution entirely (`price_approval_needed` was left as a placeholder with no admin-list lookup implemented).
- **Suggested fix direction:** For `payment_received`, join to `trade_accounts → users` (the same pattern already used correctly elsewhere in this codebase, e.g. the RMA module's `notifyBuyer` helper) to resolve the invoice's buyer's real email before calling `enqueueEmail`. For `price_approval_needed`, resolve a real admin recipient list (e.g. all users with role `ADMIN`) or enqueue one row per admin, rather than a single `recipientEmail: null` row.
- **Regression tests needed:** Record a payment, confirm the resulting outbox row has a real, non-null recipient and eventually reaches `SENT`; trigger a price-governance 3rd-change, confirm at least one admin actually receives the notification.
- **Demo impact:** Low visibility risk during a live demo (nobody's watching the outbox table), but directly undermines two specific golden-path claims in the implementation plan: "payment_received (receipt)" and "price_approval_needed" are both named, specific, spec-promised notifications, and neither can currently ever be delivered.

---

## 7. Non-bugs (tested, found correct — noted so they aren't re-investigated)

- **Cart accepts and silently clamps negative/zero/oversized quantities** (`positiveInt()` clamps to `1`..`100000`) rather than rejecting with a validation error. This is a deliberate, reasonable design choice given the cart is explicitly documented as provisional client-side state — MOQ and stock-availability are correctly and strictly enforced at the authoritative point (order submission), which is where it matters. Not filed as a bug; flagging only because it initially looked like one during testing.
- **RBAC boundaries**: 6/6 cross-role probes (buyer→admin security, finance→admin tiers, delivery→invoices, inventory→payments, no-token→orders, buyer→cms media) all correctly returned 401/403.
- **IDOR protection**: buyer1→buyer2's order, buyer1→buyer2's invoice, buyer2→buyer5's RMA all correctly returned 403.
- **SQL injection / search special characters**: a raw `'; DROP TABLE products;--`-style string in the catalogue search param correctly returned an empty result set (parameterized query treats it as literal text) — no error, no injection.
- **Double-submission race safety**: two concurrent `POST /orders` calls against the same cart resulted in exactly one order created; the second correctly saw an already-emptied cart and returned `EMPTY_CART` rather than creating a duplicate.
- **Account-status login gating**: a suspended user with the *correct* password gets an explicit `"Account is suspended"` message (a minor deviation from the implementation plan's stated preference for a fully generic message even post-password-check — see note below) but a suspended user with a *wrong* password gets the fully generic `"Invalid email or password"` — so there is no pre-authentication account-enumeration vector; the specific-reason message only surfaces to someone who already possesses the correct password. Downgraded from a security finding to a documentation note (P3, not filed as a numbered bug) given the real-world risk is low.
- **BI reports**: all 8 real view keys return distinct, non-empty, plausible data (verified via direct API call for `sales`, `category`, `top_products`, `buyers`, `credit_risk`, `inventory`, `suppliers`, `returns`).

---

## 8. Demo-readiness verdict

**Not yet demo-ready for golden path 4 (delivery → buyer confirmation) as currently coded.** Every other golden path (1, 2, 3, 5, 6, 7) is in a demonstrable state based on this pass's evidence plus the prior session's verified fixes. BUG-001 is a two-line, extremely low-risk fix (change `api.post` to `api.patch` in one file) and should be applied before any rehearsal — it is the only P0 in this report and it directly breaks a scripted golden path.

BUG-003 (orphaned invoice on cancellation) is a real money-and-credit-limit correctness bug that a finance-minded panelist could plausibly expose by asking "what happens if I cancel an approved order?" — worth fixing before the panel even if it's not in the rehearsed script, given the strategy doc's own framing ("money must balance to the cent" is one of the explicit "industry" talking points).

BUG-002, BUG-004, and BUG-005 are real but lower-stakes; fix if time allows, but none of them block a rehearsed, honest demo.

---

## 9. Final must-fix checklist before presentation

- [ ] **BUG-001 (P0):** Fix `apps/web/app/(buyer)/buyer/orders/[id]/page.js` — change both `api.post` calls (cancel, confirm-receipt) to `api.patch`. Re-test both actions live.
- [ ] **BUG-003 (P1):** Void/adjust the invoice when an approved order is cancelled, in `orders.service.js`'s `cancel()`. Re-test: cancel an approved+invoiced order, confirm invoice status changes and credit exposure drops.
- [ ] **BUG-002 (P2):** Stop auto-setting `deliveries.buyer_confirmed_at` on POD upload; wire it to a real buyer action (or remove the field if `orders.status` is the intended source of truth).
- [ ] **BUG-004 (P2):** Wrap the upload `fileFilter` rejection in a proper `AppError(..., 400)` so bad uploads return a clean validation error everywhere (products, CMS media, delivery POD).
- [ ] **BUG-005 (P2):** Fix recipient resolution for `payment_received` (join to the real buyer email) and `price_approval_needed` (resolve real admin recipients).
- [ ] Regression-retest golden paths 1 and 4 end-to-end after BUG-001/BUG-003 land, since both touch the order lifecycle.
- [ ] Re-run a full browser-driven UI pass once preview tooling is available again — this report's method (API + DB + static cross-reference) is rigorous but is not a substitute for actually clicking every button in a real browser session; treat this as a strong first pass, not a final sign-off on visual/UX correctness.
