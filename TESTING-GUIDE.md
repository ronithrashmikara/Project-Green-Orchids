# Orchids — Role Testing Guide

**What this is:** for every account role — what the account *can do*, and a hands-on **test checklist** you can walk through in the browser. Every item below was verified during the audit rounds; expected results reflect current fixed behavior.

**Stack:** web at `http://localhost:3100` · API at `http://localhost:5000` · both must be running (`node src/index.js` in `apps/api`, `next start -p 3100` in `apps/web`).

**Seeded accounts**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.invalid` | `Staff@1234` |
| Finance Officer | `finance@example.invalid` | `Staff@1234` |
| Inventory Manager | `inventory@example.invalid` | `Staff@1234` |
| Delivery Coordinator | `delivery@example.invalid` | `Staff@1234` |
| Sales Manager | `sales1@` / `sales2@example.invalid` | `Staff@1234` |
| Trade Buyer | `buyer1@ … buyer8@example.invalid` | `Buyer@1234` |

> ⚠️ Environment limitations: email OTP/reset links need real SMTP (codes are discarded by the dev mail transport); invoice online payment needs `STRIPE_SECRET_KEY`. Both fail gracefully — see notes inline.

---

## 1. VISITOR (not signed in)

**Can do:** browse all public pages, search/filter the catalogue, register a business application, request password reset, view live system status.

### Checklist
- [ ] All pages load: `/` `/catalogue` `/about` `/contact` `/pricing` `/trade-terms` `/help-centre` `/privacy` `/terms` `/cookies` `/status`
- [ ] Catalogue: search box filters live; Type / Category / Supplier dropdowns filter
- [ ] Product cards show "Sign in to order" instead of buy buttons
- [ ] `/status` shows live API + DB health (kill the API process → status flips to outage on next poll)
- [ ] Cookie banner: Accept all / Reject non-essential / Manage preferences all respond
- [ ] **Register:** fill Business Name, Reg No, Phone, Email, Address, Password ×2 → "Submit application" → expect *"Check your email for a code"* screen
  - Local SMTP limitation: the 6-digit code isn't retrievable without SMTP. To continue testing downstream, verify manually in DB:
    ```sql
    UPDATE users SET email_verified_at = NOW() WHERE email = '<your-new-email>';
    ```
- [ ] **Login errors:** wrong password → red inline *"Invalid email or password"*; unknown email → same
- [ ] **Forgot password:** submit any seeded email → *"Check your email"* message + reset token row created (completion needs the emailed link)
- [ ] Deep-linking a portal page while logged out (e.g. `/admin/dashboard`) redirects to `/login`

---

## 2. ADMIN

**Can do:** everything — buyer approvals & credit/tier control, full catalogue CRUD incl. SKU auto-generation, bulk tiers, governed price changes, stock adjustments, order claim/approve/reject/cancel, RFQ quoting & conversion oversight, RMA decisions, delivery assignment, reports/BI, CMS content + media, staff accounts, security panel.

### Checklist
- [ ] **Dashboard:** metrics populated (total products, revenue, pending approvals), recent orders clickable
- [ ] **Buyers → Approval Queue:** Approve a pending registration → modal with Tier (SILVER/GOLD/PLATINUM) + credit limit + terms → confirm → row leaves queue, buyer can then sign in. Reject requires a ≥10-char reason
- [ ] **Buyers → Directory:** rows listed with tier/status; open detail page `/admin/buyers/:id` → Update Tier / Update Credit Limit (reason required, min 5 chars) / Suspend (reason) / Reactivate
- [ ] **Tiers:** Add / Edit / Delete tier definitions
- [ ] **Suppliers:** Add supplier, Edit, Deactivate/Reactivate
- [ ] **Products list:** search, pagination, Export CSV (downloads real `.csv`), select rows → Hide Selected / Show Selected, per-row Edit / Adjust Stock / Copy / Delete
- [ ] **Add Product:** leave **SKU blank** → server generates one (`ORC-…`/`FRT-…`/`SUP-…`); duplicate explicit SKU → clean 409 error toast
- [ ] **Edit Product → Pricing tab:** "+ Add Tier" (Min Qty + Unit Price) → Save Tiers → 200; Change Price requires reason, >2 changes in 24h routes to approval queue (`/admin/pricing/approvals`)
- [ ] **Inventory tab:** adjust stock (RECEIVE/RESTOCK/DEDUCT/WRITE_OFF) → verify movement appears in Inventory → Movements
- [ ] **Media tab:** upload image (jpg/png ≤5MB), set primary, remove
- [ ] **Orders:** status tabs filter correctly; search box finds order no / buyer name; open a PENDING_APPROVAL order → Approve Order (confirm) → status APPROVED + invoice created + PENDING delivery appears under Deliveries
- [ ] **Order Reject:** requires reason ≥10 chars
- [ ] **RFQ desk:** open a SUBMITTED rfq → enter unit price (+ optional expiry date) → Send Quote → buyer receives quoted prices; ACCEPTED rfq convertible by buyer
- [ ] **RMA:** list renders; decisions available when a buyer has an open RMA (create one as buyer first)
- [ ] **Deliveries:** Assign to coordinator, advance statuses
- [ ] **Reports:** switch all 8 views (Sales Trend … Returns) — charts render; Export CSV downloads a real CSV honoring From/To dates
- [ ] **CMS:** edit Homepage Content block → Save changes → persists after reload; Media Library upload/delete; Content Blocks delete with typed confirmation
- [ ] **Users:** Create Staff Account (name/email/password + Role dropdown) → new staff can log in immediately
- [ ] **Security:** Login Activity rows appear after your own logins; Active Sessions lists live sessions (Force Logout works); Locked Accounts unlock; Audit Log paginates by real page count; Access Windows editable
- [ ] **Settings:** role access window settings save

---

## 3. TRADE BUYER (`buyer1@example.invalid` etc.)

**Can do:** browse catalogue at tier-discounted prices, cart, checkout with PO reference, track orders, confirm receipt, request returns (RMA), submit/respond to RFQs, view invoices + pay online (Stripe), file & discuss complaints, manage own account.

### Checklist
- [ ] **Dashboard:** credit exposure bar, recent orders, RFQ shortcuts — links open real pages
- [ ] **Catalogue:** prices show YOUR tier discount (SILVER 3%); zero-availability products have Add disabled ("Out")
- [ ] **Product detail:** quantity picker respects MOQ, Add to Cart works
- [ ] **Cart:** change qty ±, remove line, Clear cart, tier savings shown vs base prices
- [ ] **Checkout:** fill PO Reference + Order Note → Place Order → redirected to order detail; verify PO ref persisted:
    ```sql
    SELECT order_no, po_reference FROM orders ORDER BY id DESC LIMIT 1;
    ```
- [ ] **Checkout guard:** out-of-stock lines are rejected with a clear error (add-to-cart now prevents this)
- [ ] **Orders:** status chips filter to real statuses only (Pending approval / Approved / Dispatched / Delivered / Closed / Cancelled / Returned)
- [ ] **Order detail:** Confirm Receipt button on DELIVERED orders (status → CLOSED); Request Return on DELIVERED/CLOSED
- [ ] **Returns:** submit RMA against a delivered order line (category, qty, reason ≥20 chars) → appears in list as PENDING; admin decides it from `/admin/rma`
- [ ] **Invoices:** status chips incl. ADJUSTED/VOID/CANCELLED; Pay button on unpaid invoice → Stripe checkout (locally: clean *"Stripe payments are not configured"* error)
- [ ] **Statements:** month picker → statement totals + PDF download
- [ ] **RFQs:** New RFQ → add product line(s) + qty → Submit → redirected to detail showing `RFQ #RFQ-xxxx`; after admin quotes: quoted unit prices + expiry shown → **Accept Quote** → Convert to Order creates a real order at quoted prices
- [ ] **Complaints:** New complaint (category, priority, optional order ref, summary, details) → thread page opens; replies from sales appear in the conversation
- [ ] **Account:** upload/remove profile picture, change password (wrong current password rejected), view/sign-out other sessions

---

## 4. FINANCE OFFICER (`finance@example.invalid`)

**Can do:** financial overview, invoice list/detail/PDF, record & reverse payments, statements for any buyer, aging report, credit monitor, RMA approvals. Cannot: manage products, approve orders, handle deliveries.

### Checklist
- [ ] **Dashboard:** outstanding receivables KPIs; open-invoices panel sorted by due date ascending
- [ ] **Invoices:** status filter chips work; open invoice detail → download PDF
- [ ] **Payments:** list with Reverse buttons — reversal asks for reason + confirming officer; reversals above LKR 50,000 require the extra approver field
- [ ] **Record a payment:** pick an invoice with balance → amount, method (BANK_TRANSFER/CHEQUE/CASH/ONLINE/CREDIT_NOTE), reference → invoice paid_amount/balance_due update; exact-to-the-cent overpayment rejected
- [ ] **Credit monitor:** per-buyer exposure table renders
- [ ] **Statements:** pick any buyer + month → Generate → statement totals correct; PDF downloads
- [ ] **Aging:** buckets render; Export CSV downloads
- [ ] Buyer selector loads buyers without 403 (fixed via migration 0021)

---

## 5. INVENTORY MANAGER (`inventory@example.invalid`)

**Can do:** stock overview dashboards, read product stock, movement ledger, low/out-of-stock alerts + acknowledgement, stock adjustments & price changes (via product workspace), RMA item receiving.

### Checklist
- [ ] **Dashboard:** total SKUs, stock value, low-stock & out-of-stock counts match reality
- [ ] **Products:** read-only stock table across all SKUs
- [ ] **Movements:** ledger lists ORDER_RESERVE / ORDER_FULFILL / PURCHASE rows with correct signs; **Export CSV** downloads
- [ ] **Alerts:** Acknowledge moves an alert out of OPEN
- [ ] Stock adjustments: open `/admin/products` (RBAC permits) → Adjust Stock on any product → RECEIVE/DEDUCT updates stock and writes a movement row
- [ ] Price changes land in `/admin/pricing/approvals` queue for ADMIN approval (two-person rule — inventory cannot self-approve)
- [ ] RMA "item received": inventory marks received items into stock (finance approves, inventory receives)

## 6. DELIVERY COORDINATOR (`delivery@example.invalid`)

**Can do:** see deliveries assigned to them (plus unassigned pool), advance statuses, upload proof-of-delivery.

### Checklist
- [ ] **Dashboard:** assignment summary counts
- [ ] **My Deliveries:** only ASSIGNED/DISPATCHED/IN_TRANSIT/DELIVERED rows for you; status filter works
- [ ] **Assign:** admin assigns → appears in your list
- [ ] **Dispatch:** confirm → status DISPATCHED; stock physically decrements and ORDER_FULFILL movements appear (verify: `SELECT movement_type,qty FROM stock_movements WHERE ref_id='<orderId>'`)
- [ ] **Mark In Transit** → IN_TRANSIT
- [ ] **Mark Delivered:** POD photo mandatory (Confirm disabled until attached) → upload jpg/png → DELIVERED; buyer gets notified and can Confirm Receipt
- [ ] Failed-delivery retry path: FAILED → Dispatch again restocks then re-ships

## 7. SALES MANAGER (`sales1@example.invalid`)

**Can do:** claim/approve/reject pending orders, set availability (drives auto-assignment), handle buyer complaint threads, view team workload.

### Checklist
- [ ] **Dashboard:** availability toggle Available/Away (persists), team workload panel
- [ ] **Approvals queue:** unassigned orders claimable; Claim → assigned to You; Approve (confirm dialog) → order APPROVED; Reject requires reason
- [ ] **Complaints:** open thread → reply (message posts, buyer sees it) → update status IN_PROGRESS/RESOLVED/CLOSED
- [ ] Least-busy auto-assignment: with two AVAILABLE managers, new orders alternate
- [ ] RFQ quoting is admin-only by design (flagged as a possible future grant)

---

## Cross-role scenarios worth testing end-to-end

1. **Full golden path:** buyer registers → admin verifies/approves → buyer carts items → checkout w/ PO → admin approves (stock reserved, invoice issued) → coordinator dispatches (stock ships) → delivered + POD → buyer confirms receipt → finance records payment → PAID.
2. **Cancellation paths:** buyer cancels before approval (reservation released); admin cancels approved-but-undispatched order (invoice voided, delivery cancelled); cancel attempt AFTER dispatch → blocked.
3. **RMA loop:** buyer requests return on delivered order → finance/admin approves → inventory receives items back into stock → resolution issues invoice credit reducing balance due.
4. **Concurrent sanity:** two admins approving the same order — second gets clean 409, never double invoice.
5. **Security spot checks (should all be 403):**
   - buyer2 `GET /api/buyers/<buyer1-account-id>/payments`
   - delivery coordinator `PATCH /api/orders/<any>/cancel`
   - any staff `GET /api/cart` should not even be called from staff pages anymore

## Known environment limitations (not bugs)

| Thing | Why | Workaround |
|---|---|---|
| Email OTP / reset links not receivable | Dev mail transport discards messages without SMTP creds | Advance tokens manually in DB or wire real SMTP |
| Invoice Pay → "Stripe not configured" | No `STRIPE_SECRET_KEY` locally | Set keys or test the graceful-error path |
| Seed accumulates session state | Demo data evolves as you click | Fresh slate: `migrate` + `seed` (`ALLOW_DATABASE_RESET=true`) |
