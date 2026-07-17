-- 0016_sales_managers_complaints.sql
-- Sales Manager role, buyer complaints, staff availability, and
-- availability-based order-approval assignment.
--
-- NOTE: this file is intentionally idempotent (like 0002) because scripts/seed.js
-- re-runs it after wiping roles/permissions.

-- ============================================================
-- COMPLAINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
  id          SERIAL PRIMARY KEY,
  buyer_id    UUID NOT NULL REFERENCES users(id),
  order_id    INT REFERENCES orders(id),
  subject     TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'OTHER'
                CHECK (category IN ('ORDER_ISSUE','DELIVERY','QUALITY','BILLING','OTHER')),
  priority    TEXT NOT NULL DEFAULT 'MEDIUM'
                CHECK (priority IN ('LOW','MEDIUM','HIGH')),
  status      TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  assigned_to UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_complaints_updated_at ON complaints;
CREATE TRIGGER trg_complaints_updated_at
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_complaints_buyer    ON complaints(buyer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status   ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned ON complaints(assigned_to);

-- ============================================================
-- COMPLAINT MESSAGES (buyer <-> staff thread)
-- ============================================================
CREATE TABLE IF NOT EXISTS complaint_messages (
  id           SERIAL PRIMARY KEY,
  complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES users(id),
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_complaint ON complaint_messages(complaint_id);

-- ============================================================
-- STAFF AVAILABILITY (work-distribution toggle)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_availability (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'AWAY'
               CHECK (status IN ('AVAILABLE','AWAY')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDER APPROVAL ASSIGNMENT
-- (orders only has approved_by/cancelled_by; no assignment column existed)
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_orders_assigned ON orders(assigned_to);

COMMENT ON COLUMN orders.assigned_to IS 'Sales manager assigned to review this order while PENDING_APPROVAL (NULL = unassigned, any approver may claim)';

-- ============================================================
-- ROLE + PERMISSIONS
-- ============================================================
INSERT INTO roles (name, description) VALUES
  ('SALES_MANAGER', 'Order approvals and buyer complaint handling')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description;

INSERT INTO permissions (code, description) VALUES
  ('complaint.create',    'Create a complaint'),
  ('complaint.view.own',  'View own complaints'),
  ('complaint.view.all',  'View all complaints'),
  ('complaint.handle',    'Claim, update, and resolve complaints'),
  ('availability.manage', 'Set own staff availability status')
ON CONFLICT (code) DO UPDATE
  SET description = EXCLUDED.description;

DO $$
DECLARE
  v_admin_id SMALLINT;
  v_buyer_id SMALLINT;
  v_sales_id SMALLINT;
BEGIN
  SELECT id INTO v_admin_id FROM roles WHERE name = 'ADMIN';
  SELECT id INTO v_buyer_id FROM roles WHERE name = 'TRADE_BUYER';
  SELECT id INTO v_sales_id FROM roles WHERE name = 'SALES_MANAGER';

  -- ADMIN keeps ALL permissions (picks up the new complaint.* / availability.* codes)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_admin_id, id FROM permissions
  ON CONFLICT DO NOTHING;

  -- TRADE_BUYER: raise and follow own complaints
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_buyer_id, id FROM permissions WHERE code IN (
    'complaint.create', 'complaint.view.own'
  )
  ON CONFLICT DO NOTHING;

  -- SALES_MANAGER: order approval + complaint handling
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_sales_id, id FROM permissions WHERE code IN (
    'order.approve', 'order.view.all',
    'complaint.view.all', 'complaint.handle',
    'availability.manage',
    'product.view', 'stock.view',
    'report.view'
  )
  ON CONFLICT DO NOTHING;
END
$$;
