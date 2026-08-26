-- 0020_revoke_buyer_stock_view.sql
-- R-P2 fix: TRADE_BUYER held stock.view, which let buyers read internal
-- /inventory/* movement/alert/summary endpoints (over-grant). Revoke it.

DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'stock.view')
  AND role_id IN (SELECT id FROM roles WHERE name = 'TRADE_BUYER');
