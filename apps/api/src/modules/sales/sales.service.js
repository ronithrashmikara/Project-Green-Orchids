const { query } = require('../../config/db');
const { writeAudit } = require('../../middleware/audit');

const service = {
  // All sales managers with availability status + open workload counts.
  async listAvailability() {
    const r = await query(
      `SELECT u.id, u.full_name, u.email,
              COALESCE(sa.status, 'AWAY') AS availability,
              sa.updated_at AS availability_updated_at,
              (SELECT COUNT(*)::int FROM complaints c
                WHERE c.assigned_to = u.id AND c.status IN ('OPEN','IN_PROGRESS')) AS open_complaints,
              (SELECT COUNT(*)::int FROM orders o
                WHERE o.assigned_to = u.id AND o.status = 'PENDING_APPROVAL') AS pending_orders
       FROM users u
       INNER JOIN roles ro ON ro.id = u.role_id AND ro.name = 'SALES_MANAGER'
       LEFT JOIN staff_availability sa ON sa.user_id = u.id
       WHERE u.status = 'ACTIVE'
       ORDER BY u.full_name ASC`
    );
    return r.rows.map(row => ({ ...row, open_workload: row.open_complaints + row.pending_orders }));
  },

  // Sales manager toggles their own AVAILABLE/AWAY flag (upsert).
  async setAvailability(userId, status) {
    const r = await query(
      `INSERT INTO staff_availability (user_id, status, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
       RETURNING user_id, status, updated_at`,
      [userId, status]
    );
    await writeAudit({ actor: userId, action: 'AVAILABILITY_CHANGED', entityType: 'staff_availability',
      entityId: userId, after: { status } });
    return r.rows[0];
  },

  // Combined work queue: my assigned pending order approvals + open complaints,
  // plus unassigned ones anyone with the permission can claim.
  async queue(userId) {
    const [orders, complaints] = await Promise.all([
      query(
        `SELECT o.id, o.order_no, o.status, o.total, o.assigned_to, o.created_at,
                ta.business_name AS buyer_name
         FROM orders o
         LEFT JOIN trade_accounts ta ON ta.id = o.buyer_id
         WHERE o.status = 'PENDING_APPROVAL' AND (o.assigned_to = $1 OR o.assigned_to IS NULL)
         ORDER BY o.created_at ASC`,
        [userId]
      ),
      query(
        `SELECT c.id, c.subject, c.category, c.priority, c.status, c.assigned_to, c.created_at,
                bu.full_name AS buyer_name, o.order_no
         FROM complaints c
         LEFT JOIN users bu ON bu.id = c.buyer_id
         LEFT JOIN orders o ON o.id = c.order_id
         WHERE c.status IN ('OPEN','IN_PROGRESS') AND (c.assigned_to = $1 OR c.assigned_to IS NULL)
         ORDER BY CASE c.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END, c.created_at ASC`,
        [userId]
      ),
    ]);
    const mine = (rows) => rows.filter(x => x.assigned_to === userId).length;
    return {
      orders: orders.rows,
      complaints: complaints.rows,
      summary: {
        assignedOrders: mine(orders.rows),
        unassignedOrders: orders.rows.length - mine(orders.rows),
        assignedComplaints: mine(complaints.rows),
        unassignedComplaints: complaints.rows.length - mine(complaints.rows),
      },
    };
  },
};
module.exports = service;
