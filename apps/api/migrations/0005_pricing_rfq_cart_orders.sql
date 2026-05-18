-- 0005_pricing_rfq_cart_orders.sql
-- Price history, price-change requests, RFQs, carts, orders, stock movements

-- ============================================================
-- PRICE HISTORY (immutable audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS price_history (
  id         BIGSERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price  NUMERIC(12,2),
  new_price  NUMERIC(12,2) NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source     TEXT NOT NULL DEFAULT 'MANUAL'
               CHECK (source IN ('MANUAL','BULK_IMPORT','PRICE_REQUEST'))
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);

-- ============================================================
-- PRICE CHANGE REQUESTS (governed price changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS price_change_requests (
  id              SERIAL PRIMARY KEY,
  product_id      INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES users(id),
  current_price   NUMERIC(12,2) NOT NULL,
  requested_price NUMERIC(12,2) NOT NULL CHECK (requested_price > 0),
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  decided_by      UUID REFERENCES users(id),
  decided_at      TIMESTAMPTZ,
  decision_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_price_change_requests_updated_at
  BEFORE UPDATE ON price_change_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RFQs (Request for Quotation)
-- ============================================================
CREATE TABLE IF NOT EXISTS rfqs (
  id           SERIAL PRIMARY KEY,
  rfq_no       TEXT NOT NULL UNIQUE,
  buyer_id     UUID NOT NULL REFERENCES trade_accounts(id),
  status       TEXT NOT NULL DEFAULT 'DRAFT'
                 CHECK (status IN ('DRAFT','SUBMITTED','QUOTED','EXPIRED','DECLINED','CONVERTED')),
  buyer_note   TEXT,
  admin_note   TEXT,
  quote_expiry TIMESTAMPTZ,
  quoted_by    UUID REFERENCES users(id),
  quoted_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rfqs_updated_at
  BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rfqs_buyer  ON rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs(status);

-- ============================================================
-- RFQ ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS rfq_items (
  id                    SERIAL PRIMARY KEY,
  rfq_id                INT NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  product_id            INT NOT NULL REFERENCES products(id),
  requested_qty         INT NOT NULL CHECK (requested_qty > 0),
  requested_unit_price  NUMERIC(12,2),
  quoted_unit_price     NUMERIC(12,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq ON rfq_items(rfq_id);

-- ============================================================
-- CARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   UUID NOT NULL UNIQUE REFERENCES trade_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- CART ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS cart_items (
  id         SERIAL PRIMARY KEY,
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  qty        INT NOT NULL CHECK (qty > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                  SERIAL PRIMARY KEY,
  order_no            TEXT NOT NULL UNIQUE,
  buyer_id            UUID NOT NULL REFERENCES trade_accounts(id),
  source              TEXT NOT NULL DEFAULT 'DIRECT'
                        CHECK (source IN ('DIRECT','RFQ_CONVERSION','CART')),
  rfq_id              INT REFERENCES rfqs(id),
  status              TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
                        CHECK (status IN (
                          'DRAFT','PENDING_APPROVAL','APPROVED','REJECTED',
                          'PROCESSING','READY_TO_SHIP','DISPATCHED',
                          'DELIVERED','CANCELLED','RETURNED'
                        )),
  subtotal            NUMERIC(14,2) NOT NULL DEFAULT 0,
  tier_discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total               NUMERIC(14,2) NOT NULL DEFAULT 0,
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  cancelled_by        UUID REFERENCES users(id),
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_buyer       ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_rfq         ON orders(rfq_id);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id                    SERIAL PRIMARY KEY,
  order_id              INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            INT NOT NULL REFERENCES products(id),
  qty                   INT NOT NULL CHECK (qty > 0),
  unit_price_at_order   NUMERIC(12,2) NOT NULL CHECK (unit_price_at_order > 0),
  price_source          TEXT NOT NULL DEFAULT 'BASE'
                          CHECK (price_source IN ('BASE','BULK_TIER','RFQ_QUOTE','MANUAL')),
  line_total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ============================================================
-- STOCK MOVEMENTS (immutable ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id           BIGSERIAL PRIMARY KEY,
  product_id   INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL
                  CHECK (movement_type IN (
                    'INITIAL','PURCHASE','ORDER_RESERVE','ORDER_RELEASE',
                    'ORDER_FULFILL','RMA_RETURN','MANUAL_ADJUSTMENT',
                    'DAMAGE_WRITE_OFF','STOCKTAKE_CORRECTION'
                  )),
  qty          INT NOT NULL,
  ref_table    TEXT,
  ref_id       TEXT,
  performed_by UUID REFERENCES users(id),
  note         TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_time    ON stock_movements(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref     ON stock_movements(ref_table, ref_id);
