-- 0017_payment_gateway_transactions.sql
-- Stripe checkout transaction ledger.
--
-- Buyer-initiated online payments must not write directly to `payments`.
-- They create an auditable gateway transaction first; only a verified
-- server-to-server Stripe webhook may settle it into the payments ledger.

CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
  id                 SERIAL PRIMARY KEY,
  gateway            TEXT NOT NULL DEFAULT 'STRIPE'
                       CHECK (gateway = 'STRIPE'),
  gateway_order_id   TEXT NOT NULL UNIQUE,
  invoice_id         INT NOT NULL REFERENCES invoices(id),
  buyer_id           UUID NOT NULL REFERENCES trade_accounts(id),
  amount             NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency           TEXT NOT NULL DEFAULT 'LKR',
  status             TEXT NOT NULL DEFAULT 'INITIATED'
                       CHECK (status IN (
                         'INITIATED','PENDING','COMPLETED','CANCELLED',
                         'FAILED','CHARGEDBACK','REQUIRES_REVIEW','IGNORED'
                       )),
  gateway_payment_id TEXT UNIQUE,
  checkout_payload   JSONB NOT NULL DEFAULT '{}'::jsonb,
  notify_payload     JSONB,
  status_message     TEXT,
  method             TEXT,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_payment_gateway_transactions_updated_at
  ON payment_gateway_transactions;
CREATE TRIGGER trg_payment_gateway_transactions_updated_at
  BEFORE UPDATE ON payment_gateway_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payment_gateway_transactions_invoice
  ON payment_gateway_transactions(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_transactions_buyer
  ON payment_gateway_transactions(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_transactions_status
  ON payment_gateway_transactions(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_transactions_payment_id
  ON payment_gateway_transactions(gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;
