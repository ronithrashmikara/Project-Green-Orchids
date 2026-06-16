# Project Green — Bug-Fix Proof Report

All 30 audited findings remediated in code, with before/after evidence per fix and a passing verification run. Companion to the Security Audit.

**30 / 30 fixed · 11 / 11 verify tests green** · 9 code files · migration 0009 · 3 new utils · Date: 16 June 2026.

Scope: 30 findings across orders, payments, pricing, auth.
Areas: A. Schema vs code (8) · B. Money & invoice (5) · C. Price governance (2) · D. Auth/RBAC/security (6) · E. Transactions (4) · F. Indexing (5).

## Findings

### 1. Pricing wrote to a non-existent price_changes table

**Severity:** P0 · **Status:** FIXED
**Files:** products.service.js · pricing.service.js · pricing.repository.js

Removed the phantom price_changes table. Direct changes write immutable price_history; governed changes create a price_change_requests row; approval writes price_history(source=PRICE_REQUEST).

### 2. Order/credit used trade_accounts.available_credit & .tier (absent)

**Severity:** P0 · **Status:** FIXED
**Files:** orders.repository.js

available_credit computed as credit_limit − unpaid invoice balances inside the locked txn; tier discount read from buyer_tiers.discount_rate via tier_id. Hard-coded TIER_* map deleted.

### 3. Cart used products.is_active & cart_items.buyer_id (absent)

**Severity:** P0 · **Status:** FIXED
**Files:** orders.repository.js · orders.service.js

Cart items joined through carts (cart_items.cart_id → carts.buyer_id); availability uses status=ACTIVE; clearCart deletes by cart_id.

### 4. Column drift: orders / order_items / invoices / stock_movements

**Severity:** P0 · **Status:** FIXED
**Files:** orders.repository.js

Every INSERT/SELECT mapped to the real migration columns (order_no/total/source, qty/unit_price_at_order/price_source, invoice_no, stock_movements qty/ref_table/ref_id/performed_by).

### 5. Invalid CHECK enum values written at runtime

**Severity:** P0 · **Status:** FIXED
**Files:** orders.repository.js · payments.service.js · migration 0009

Invoice status uses PENDING; online payments use ONLINE; reservations use ORDER_RESERVE/ORDER_RELEASE. 0009 adds CLOSED/ADJUSTED/ACCEPTED/CONFIRMED.

### 6. Double payment reversal (guard read a missing status column)

**Severity:** P0 · **Status:** FIXED
**Files:** payments.repository.js · payments.service.js

Reversal detected via reversed_at; a second reversal throws ALREADY_REVERSED.

### 7. Reservation decremented physical stock; availability ignored reserved_qty

**Severity:** P0 · **Status:** FIXED
**Files:** orders.repository.js · orders.service.js

Reservation bumps reserved_qty (stock_qty intact); availability = stock_qty − reserved_qty on FOR UPDATE rows; dispatch converts the reservation.

### 8. State-machine names didn't match DB enums (every approval 409'd)

**Severity:** P0 · **Status:** FIXED
**Files:** utils/stateMachine.js · orders.service.js · migration 0009

Machine states renamed to exact DB enums (PENDING_APPROVAL…); confirm-receipt is DELIVERED→CLOSED; unit test asserts every ORDER state is in the DB CHECK list.

### 9. Overpayment was not rejected

**Severity:** P1 · **Status:** FIXED
**Files:** payments.service.js

Balance computed under the invoice lock; a payment exceeding it throws 422 with the maximum acceptable amount.

### 10. Invoice balance ignored invoice_adjustments (hard-coded 0)

**Severity:** P1 · **Status:** FIXED
**Files:** payments.service.js · payments.repository.js

balance_due = total_amount + adjustments − paid_amount, recomputed under the lock; balance reaching 0 via credit adjustment yields ADJUSTED, not PAID.

### 11. Two-person reversal control was bypassable

**Severity:** P1 · **Status:** FIXED
**Files:** payments.service.js · payments.controller.js

A reversal over 50,000 requires a confirmed_by that is present and different from the actor; controller passes the approver from the request body.

### 12. Invoice due_date always NET30 (term read from a missing column)

**Severity:** P1 · **Status:** FIXED
**Files:** orders.service.js · utils/time.js (new)

Due date computed from the buyer trade_account payment_term mapped to days in Asia/Colombo via toColomboDate/dueDateForTerm.

### 13. PayHere notify mapped order_id→invoice_id; weak idempotency

**Severity:** P1 · **Status:** FIXED
**Files:** payments.service.js · payments.repository.js

Notify resolves OUR invoice from the PayHere order ref; method ONLINE; bad signatures audited+ignored; duplicates caught by UNIQUE(invoice_id,method,reference).

### 14. Governed price change took no lock and wrote no price_history

**Severity:** P1 · **Status:** FIXED
**Files:** products.service.js · pricing.service.js

changePrice runs in a txn with SELECT … FOR UPDATE, re-counts the rolling 24h window from price_history, rejects same-price no-ops, writes history atomically; approval re-locks and verifies current price.

### 15. Buyer self-cancel compared user-id to trade-account-id

**Severity:** P1 · **Status:** FIXED
**Files:** orders.service.js

Caller trade_account id resolved and compared to order.buyer_id to decide BUYER vs ADMIN.

### 16. IDOR ownership compared user-id vs trade-account-id

**Severity:** P1 · **Status:** FIXED
**Files:** orders.service.js · orders.repository.js · orders.controller.js

Buyer scoping resolves trade_accounts.id once (accountIdForUser); isAdmin checks the order.view.all permission, not an invented role.

### 17. Append-only guarantee was inert (REVOKE gated on a missing role)

**Severity:** P1 · **Status:** FIXED
**Files:** migration 0009

Role-independent BEFORE UPDATE/DELETE triggers RAISE on audit_logs, stock_movements and price_history.

### 18. Suspension latency up to 30s (no cache-bust)

**Severity:** P2 · **Status:** FIXED
**Files:** middleware/auth.js · buyers.service.js

auth exports bustUserStatus(); suspend handler calls it so the cached ACTIVE status is dropped immediately.

### 19. Audit redaction shallow; audit writer used wrong columns

**Severity:** P2 · **Status:** FIXED
**Files:** middleware/audit.js

Redaction recursive + regex (/secret|token|password|hash|api_key/i); INSERT corrected to actor_id/actor_role/entity_type; writeAudit accepts a tx client.

### 20. INVENTORY_MANAGER could approve price changes

**Severity:** P2 · **Status:** FIXED
**Files:** migration 0009

price.approve removed from INVENTORY_MANAGER, restoring the ADMIN-only / two-person separation.

### 21. State machine referenced roles that don't exist

**Severity:** P2 · **Status:** FIXED
**Files:** utils/stateMachine.js

Invented roles replaced with real actor tokens ADMIN/BUYER/INVENTORY/FINANCE/DELIVERY/SYSTEM.
