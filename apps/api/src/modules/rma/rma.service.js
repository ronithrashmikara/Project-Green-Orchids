const { tx, query } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { assertTransition } = require('../../utils/stateMachine');
const { paginate } = require('../../utils/pagination');
const repo = require('./rma.repository');

const service = {
  async create(data, buyerId) {
    const rmaNumber = await repo.nextRmaNumber();
    const rma = await repo.create(null, { ...data, rma_number: rmaNumber, buyer_id: buyerId });
    try {
      const { query } = require('../../config/db');
      const u = await query('SELECT name, email FROM users WHERE id=$1', [buyerId]);
      if (u.rows.length) await sendMail({ to: u.rows[0].email, subject: 'RMA Received', template: 'rma_received', data: { name: u.rows[0].name, rmaNumber, orderNumber: '', itemDescription: data.return_type, reason: data.reason } });
    } catch (_) {}
    return rma;
  },

  async list(queryParams, buyerId, isAdmin) {
    const o = paginate(queryParams);
    const { rows, total } = await repo.findAll(isAdmin ? null : buyerId, isAdmin, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async get(id, buyerId, isAdmin) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    if (!isAdmin && r.buyer_id !== buyerId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    return r;
  },

  async review(id, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'UNDER_REVIEW', role);
    await repo.updateStatus(null, id, 'UNDER_REVIEW');
  },

  async approve(id, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'APPROVED', role);
    await repo.updateStatus(null, id, 'APPROVED');

    try {
      const u = await query('SELECT name, email FROM users WHERE id=$1', [r.buyer_id]);
      if (u.rows.length) await sendMail({ to: u.rows[0].email, subject: 'RMA Approved', template: 'rma_decision', data: { name: u.rows[0].name, rmaNumber: r.rma_number, decision: 'approved' } });
    } catch (_) {}
  },

  async reject(id, data, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'REJECTED', role);
    await repo.update(null, id, { status: 'REJECTED', rejection_reason: data.reason });

    try {
      const u = await query('SELECT name, email FROM users WHERE id=$1', [r.buyer_id]);
      if (u.rows.length) await sendMail({ to: u.rows[0].email, subject: 'RMA Declined', template: 'rma_decision', data: { name: u.rows[0].name, rmaNumber: r.rma_number, decision: 'declined', reason: data.reason } });
    } catch (_) {}
  },

  async receive(id, data, actor) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'ITEM_RECEIVED', actor);

    await tx(async (client) => {
      await repo.updateStatus(client, id, 'ITEM_RECEIVED');

      // Inventory: restock or write-off
      const movType = data.disposition === 'RESTOCK' ? 'RESTOCK' : 'WRITE_OFF';
      await client.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, note, reference_type, reference_id, created_by)
         SELECT oi.product_id, $1, $2, $3, 'RMA', $4, $5 FROM order_items oi WHERE oi.id = $6`,
        [movType, r.quantity, data.notes, id, actor, r.order_item_id]
      );

      if (data.disposition === 'RESTOCK') {
        await client.query(
          `UPDATE products SET stock_qty = stock_qty + $1, updated_at = NOW()
           WHERE id = (SELECT product_id FROM order_items WHERE id = $2)`,
          [r.quantity, r.order_item_id]
        );
      }
    });
  },

  async resolve(id, data, actor) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'RESOLVED', actor);

    await tx(async (client) => {
      await repo.updateStatus(client, id, 'RESOLVED');
      await repo.update(client, id, { resolution_type: data.resolution, adjustment_amount: data.adjustment_amount || 0 });

      if (data.adjustment_amount > 0) {
        // Create invoice adjustment
        const order = await client.query('SELECT * FROM orders WHERE id = $1', [r.order_id]);
        if (order.rows.length) {
          const invoice = await client.query('SELECT id FROM invoices WHERE order_id = $1 LIMIT 1', [r.order_id]);
          if (invoice.rows.length) {
            await client.query(
              `INSERT INTO invoice_adjustments (invoice_id, adjustment_type, amount, reason, reference_id)
               VALUES ($1, 'CREDIT_NOTE', $2, $3, $4)`,
              [invoice.rows[0].id, data.adjustment_amount, data.notes || 'RMA Resolution', id]
            );
          }
        }
      }
    });

    try {
      const u = await query('SELECT name, email FROM users WHERE id=$1', [r.buyer_id]);
      if (u.rows.length) await sendMail({ to: u.rows[0].email, subject: 'RMA Resolved', template: 'rma_resolved', data: { name: u.rows[0].name, rmaNumber: r.rma_number, resolution: data.resolution, adjustmentAmount: data.adjustment_amount || 0 } });
    } catch (_) {}
  },
};
module.exports = service;
