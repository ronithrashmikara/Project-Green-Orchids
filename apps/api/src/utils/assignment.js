const { query } = require('../config/db');

/**
 * Availability-based work distribution for the SALES_MANAGER role.
 *
 * pickAvailableSalesManager: returns the users.id of the AVAILABLE sales
 * manager carrying the fewest open assigned items (open complaints +
 * pending-approval orders). Ties break toward the least-recently-touched
 * assignee, then lowest id. Returns null when nobody is AVAILABLE — the item
 * stays unassigned and any sales manager / admin can claim it from the queue.
 */
async function pickAvailableSalesManager(client) {
  const run = client ? client.query.bind(client) : query;
  const r = await run(
    `SELECT u.id,
            (
              (SELECT COUNT(*) FROM complaints c
                WHERE c.assigned_to = u.id AND c.status IN ('OPEN','IN_PROGRESS'))
            + (SELECT COUNT(*) FROM orders o
                WHERE o.assigned_to = u.id AND o.status = 'PENDING_APPROVAL')
            ) AS workload,
            GREATEST(
              COALESCE((SELECT MAX(c.updated_at) FROM complaints c WHERE c.assigned_to = u.id), 'epoch'::timestamptz),
              COALESCE((SELECT MAX(o.updated_at) FROM orders o WHERE o.assigned_to = u.id), 'epoch'::timestamptz)
            ) AS last_assigned_at
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id AND r.name = 'SALES_MANAGER'
     INNER JOIN staff_availability sa ON sa.user_id = u.id AND sa.status = 'AVAILABLE'
     WHERE u.status = 'ACTIVE'
     ORDER BY workload ASC, last_assigned_at ASC, u.id ASC
     LIMIT 1`
  );
  return r.rows.length ? r.rows[0].id : null;
}

/**
 * Assign a PENDING_APPROVAL order to an available sales manager.
 * No-op (returns null, order stays unassigned) when nobody is AVAILABLE.
 */
async function assignOrderForApproval(client, orderId) {
  const assignee = await pickAvailableSalesManager(client);
  if (!assignee) return null;
  const run = client ? client.query.bind(client) : query;
  await run('UPDATE orders SET assigned_to = $1, updated_at = NOW() WHERE id = $2', [assignee, orderId]);
  return assignee;
}

module.exports = { pickAvailableSalesManager, assignOrderForApproval };
