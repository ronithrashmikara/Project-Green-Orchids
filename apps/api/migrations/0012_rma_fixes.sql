-- 0012_rma_fixes.sql
-- rma.repository.js calls nextval('rma_number_seq'), which was never created
-- (0009 added order/invoice/payment/rfq number sequences but missed rma).
-- Also add an ITEM_RECEIVED status so the admin "mark received" step (which
-- the frontend already calls) has somewhere real to land between APPROVED
-- and RESOLVED.

CREATE SEQUENCE IF NOT EXISTS rma_number_seq START 1;

DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'rma_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%PENDING%APPROVED%REJECTED%RESOLVED%CANCELLED%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE rma_requests DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE rma_requests
  ADD CONSTRAINT rma_requests_status_check
  CHECK (status IN ('PENDING','APPROVED','ITEM_RECEIVED','REJECTED','RESOLVED','CANCELLED'));
