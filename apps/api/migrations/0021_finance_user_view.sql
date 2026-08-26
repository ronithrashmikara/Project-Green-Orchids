-- 0021: Finance officers need read-only buyer context (re-audit fix).
-- The finance statements page offers a buyer selector backed by GET /buyers,
-- which requires user.view — previously every load 403'd for FINANCE_OFFICER.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'FINANCE_OFFICER' AND p.code = 'user.view'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
