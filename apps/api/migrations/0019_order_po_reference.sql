-- 0019: Order PO reference + buyer note (Audit F7).
-- The cart checkout collected both fields in the UI but the schema had nowhere
-- to put them, so they were silently dropped. B2B wholesale needs PO references
-- on orders; the buyer note is free-form handling instructions.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_note  TEXT;
