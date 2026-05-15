-- 0004_trade_catalogue.sql
-- Buyer tiers, trade accounts, suppliers, categories, products, images, bulk pricing

-- ============================================================
-- BUYER TIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS buyer_tiers (
  id            SMALLSERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  discount_rate NUMERIC(5,2) NOT NULL CHECK (discount_rate >= 0),
  credit_cap    NUMERIC(14,2) NOT NULL DEFAULT 0,
  priority      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRADE ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_accounts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL UNIQUE REFERENCES users(id),
  business_name             TEXT NOT NULL,
  business_reg_no           TEXT,
  phone                     TEXT,
  address                   TEXT,
  tier_id                   SMALLINT NOT NULL REFERENCES buyer_tiers(id),
  credit_limit              NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_term              TEXT NOT NULL DEFAULT 'NET_30'
                              CHECK (payment_term IN ('NET_15','NET_30','NET_45','NET_60')),
  account_status            TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
                              CHECK (account_status IN ('PENDING_APPROVAL','ACTIVE','SUSPENDED','CLOSED')),
  payment_reliability_score NUMERIC(3,2) NOT NULL DEFAULT 0
                              CHECK (payment_reliability_score BETWEEN 0 AND 5),
  approved_by               UUID REFERENCES users(id),
  approved_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_trade_accounts_updated_at
  BEFORE UPDATE ON trade_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  status          TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','INACTIVE')),
  lead_time_days  INT NOT NULL DEFAULT 7,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- CATEGORIES (recursive)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  parent_id INT REFERENCES categories(id) ON DELETE SET NULL,
  type      TEXT NOT NULL DEFAULT 'PRODUCT'
              CHECK (type IN ('PRODUCT','SUPPLY','BLOG')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  category_id     INT NOT NULL REFERENCES categories(id),
  supplier_id     INT NOT NULL REFERENCES suppliers(id),
  product_type    TEXT NOT NULL DEFAULT 'OTHER'
                    CHECK (product_type IN ('ORCHID','FERTILIZER','SUPPLY','OTHER')),
  unit_size       TEXT,
  base_price      NUMERIC(12,2) NOT NULL CHECK (base_price > 0),
  moq             INT NOT NULL DEFAULT 1 CHECK (moq >= 1),
  stock_qty       INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  reserved_qty    INT NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  reorder_level   INT NOT NULL DEFAULT 10,
  status          TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','INACTIVE','DISCONTINUED','OUT_OF_STOCK')),
  bloom_video_url TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_reserved_lte_stock CHECK (reserved_qty <= stock_qty)
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_products_status     ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier   ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_type       ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm  ON products USING gin (name gin_trgm_ops);

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id                   SERIAL PRIMARY KEY,
  product_id           INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cloudinary_public_id TEXT,
  url                  TEXT,
  is_primary           BOOLEAN NOT NULL DEFAULT false,
  sort_order           INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- ============================================================
-- BULK PRICING TIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS bulk_pricing_tiers (
  id           SERIAL PRIMARY KEY,
  product_id   INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INT NOT NULL CHECK (min_quantity >= 1),
  unit_price   NUMERIC(12,2) NOT NULL CHECK (unit_price > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, min_quantity)
);

CREATE INDEX IF NOT EXISTS idx_bulk_pricing_product ON bulk_pricing_tiers(product_id);
