-- 0013_buyer_tiers_fields.sql
-- The admin "Tier Management" frontend (apps/web/app/(admin)/admin/tiers)
-- lets staff configure payment terms and a minimum-orders threshold per tier,
-- but buyer_tiers only ever had name/discount_rate/credit_cap/priority.

ALTER TABLE buyer_tiers
  ADD COLUMN IF NOT EXISTS payment_terms TEXT NOT NULL DEFAULT 'Net 30',
  ADD COLUMN IF NOT EXISTS min_orders    INT NOT NULL DEFAULT 0;
