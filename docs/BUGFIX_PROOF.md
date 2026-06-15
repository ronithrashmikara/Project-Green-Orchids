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
