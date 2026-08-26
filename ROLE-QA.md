# Project Orchids — Role-by-Role QA (Round 3)

**Date:** 2026-08-26 · **Method:** for each seeded account, logged in through the real login form, walked every portal page, exercised the primary buttons/modals, and captured every non-2xx API call. Public visitor + signup/verification/approval onboarding path tested end-to-end. Fixes applied after collection; final column reflects post-fix state.

Legend: ✅ works · ⚠️ worked with issues (fixed) · ❌ broken (was) → fixed

---

## 0. Visitor (not signed in)

| Flow | Result | Notes |
|---|---|---|
| All 11 public pages render | ✅ | /, catalogue, about, contact, pricing, trade-terms, help-centre, privacy, terms, cookies, status — zero API errors |
| Catalogue search ("Moth Orchid") | ✅ | Filters live |
| Product cards as visitor | ✅ | Show "Sign in to order" prompt (by design) |
| Register (7-field application) | ✅ | 201; OTP screen shown. ⚠️ OTP can't be delivered locally without SMTP (env limitation, not a bug) |
| Pending-buyer login gate | ⚠️→✅ | Blocked correctly, but message said "verify your email" even when verified & awaiting approval — now accurate per-state message |
| Wrong password | ✅ | Inline "Invalid email or password" |
| Forgot password | ✅ | 200 + reset token persisted; completing reset needs the emailed link (SMTP env limitation) |
| Status page live poll | ✅ | Reports real API/DB health |

## 1. ADMIN (`admin@example.invalid`)

| Page / action | Result |
|---|---|
| Dashboard metrics, recent orders, RFQ feed | ✅ |
| Buyers: approval queue → Approve w/ tier+credit+terms modal | ✅ Approved new registration live (200) |
| Products: list, search, pagination, CSV export (200 text/csv), bulk hide/show | ✅ |
| Products: create w/o SKU → auto-SKU | ✅ (round 1 fix holds) |
| Products: edit save (PATCH 200), Copy (201), Delete (soft) | ✅ |
| Products: bulk pricing tiers tab add/save | ✅ (200) |
| Stock adjustment modal (RECEIVE) | ✅ (200, ledger row written) |
| Orders: filter tabs, search box, detail Approve w/ confirm | ✅ (status flipped to APPROVED) |
| RFQ desk: list, detail, send quote | ✅ (PATCH 200) |
| Deliveries: assign/dispatch/in-transit/POD | ✅ (POD upload E2E → DELIVERED) |
| Reports: all 8 views render, Export CSV | ✅ (now real CSV) |
| CMS: block save, media library, block delete | ✅ (PATCH/DELETE 200) |
| Users: Create Staff (roles dropdown + password) | ✅ (201) |
| Security: logins/sessions/locked/audit/access-windows | ✅ (all endpoints 200) |

## 2. TRADE BUYER (`buyer1..8@example.invalid`)

| Page / action | Result |
|---|---|
| Dashboard widgets + RFQ links | ⚠️→✅ Dead `/buyer/rfqs` links fixed |
| Catalogue browse/search/filter/detail | ✅ |
| Add to cart (in-stock) / blocked (zero availability) | ✅ Availability guard added |
| Cart qty ±, remove, savings display | ✅ |
| Checkout incl. PO reference → order created | ✅ PO persisted on ORD (verified in DB) |
| Orders list filters | ⚠️→✅ Phantom statuses removed, real ones added |
| Order detail: confirm receipt, request return | ✅ |
| Invoices list + status chips | ⚠️→✅ ADJUSTED/VOID/CANCELLED added |
| Invoice Pay (Stripe) | ✅ Graceful `STRIPE_NOT_CONFIGURED` 503 without keys (expected locally) |
| RFQ submit → redirect → detail | ❌→✅ Payload key + envelope unwrap + redirect fixed |
| Returns page | ✅ |
| Complaints: create + thread | ✅ (201, conversation renders) |
| Statements page | ⚠️→✅ Added to sidebar nav (was orphaned) |
| Account: avatar, password change, sessions | ✅ |

## 3. FINANCE OFFICER (`finance@example.invalid`)

| Page / action | Result |
|---|---|
| Dashboard KPIs + open invoices | ⚠️→✅ due-date sort honored client-side |
| Payments list + Reverse modal | ✅ |
| Credit monitor | ✅ |
| Statements (+PDF) buyer selector | ❌→✅ `user.view` granted to FINANCE via migration 0021 (was 403) |
| Aging report + CSV | ✅ |

## 4. INVENTORY MANAGER (`inventory@example.invalid`)

| Page / action | Result |
|---|---|
| Dashboard rollups (stock value, low/out counts) | ✅ |
| Products read-only view | ✅ |
| Movements ledger + Export CSV | ❌→✅ Export endpoint wired (was 404) |
| Alerts + Acknowledge | ✅ |

## 5. DELIVERY COORDINATOR (`delivery@example.invalid`)

| Page / action | Result |
|---|---|
| Deliveries list filtered by assignment/status | ✅ |
| Dispatch / Mark In Transit transitions | ✅ |
| Mark Delivered with mandatory POD photo upload | ✅ (PATCH 200 → DELIVERED) |

## 6. SALES MANAGER (`sales1@/sales2@example.invalid`, plus newly created staff)

| Page / action | Result |
|---|---|
| Approvals queue: Claim | ✅ Row assigned to "You" |
| Approve / Reject from queue | ✅ |
| Availability toggle (Available/Away) | ✅ (GET/PATCH 200) |
| Complaints queue + thread reply | ❌→✅ Staff replies were 403'd by a mis-applied buyer gate — route guard corrected; ownership still enforced in service |

## Cross-cutting fixes from this pass

1. **Cart 403 noise** — shared layout called `GET /api/cart` for every signed-in role; now gated to TRADE_BUYER only.
2. **Finance statements 403** — migration 0021 grants `user.view` to FINANCE_OFFICER.
3. **Login copy** — pending accounts now get an accurate message depending on whether the email is verified.

## Environment limitations (not bugs)

- Email verification / password-reset completion requires SMTP credentials (codes arrive by email; JSON transport in dev discards them). Accounts were advanced manually in DB to test downstream states.
- Stripe checkout returns a clean `STRIPE_NOT_CONFIGURED` error without keys.
