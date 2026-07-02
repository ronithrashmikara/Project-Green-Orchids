const { query } = require('../../config/db');

const repo = {
  async getCreditMonitor() {
    const r = await query(`
      SELECT
        ta.id,
        ta.business_name AS "businessName",
        bt.name AS tier,
        ta.credit_limit AS "creditLimit",
        COALESCE(inv.credit_used, 0) AS "creditUsed",
        COALESCE(inv.has_overdue, false) AS "hasOverdue",
        CASE WHEN COALESCE(pay.total_invoices, 0) = 0 THEN 100
             ELSE GREATEST(0, ROUND(100 - (100.0 * COALESCE(pay.late_payments, 0) / pay.total_invoices)))
        END AS "reliabilityScore"
      FROM trade_accounts ta
      JOIN buyer_tiers bt ON bt.id = ta.tier_id
      LEFT JOIN (
        SELECT buyer_id,
               SUM(balance_due) AS credit_used,
               BOOL_OR(status = 'OVERDUE') AS has_overdue
        FROM invoices
        WHERE status IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
        GROUP BY buyer_id
      ) inv ON inv.buyer_id = ta.id
      LEFT JOIN (
        SELECT i.buyer_id,
               COUNT(*) AS total_invoices,
               COUNT(*) FILTER (
                 WHERE EXISTS (
                   SELECT 1 FROM payments p
                   WHERE p.invoice_id = i.id AND p.reversed_at IS NULL AND p.received_at > i.due_date
                 )
               ) AS late_payments
        FROM invoices i
        GROUP BY i.buyer_id
      ) pay ON pay.buyer_id = ta.id
      WHERE ta.account_status = 'ACTIVE'
      ORDER BY "creditUsed" DESC
    `);
    return r.rows;
  },
};
module.exports = repo;
