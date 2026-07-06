const { tx, query } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { assertTransition } = require('../../utils/stateMachine');
const { paginate } = require('../../utils/pagination');
const repo = require('./rma.repository');

async function resolveAccountId(userId) {
  const acct = await repo.accountIdForUser(userId);
  if (!acct) throw new AppError('NO_ACCOUNT', 'No trade account for this user', 403);
  return acct.id;
}

async function notifyBuyer(buyerAccountId, subject, template, data) {
  try {
    const u = await query(
      `SELECT u.full_name AS name, u.email FROM trade_accounts ta JOIN users u ON u.id = ta.user_id WHERE ta.id = $1`,
      [buyerAccountId]
    );
    if (u.rows.length) await sendMail({ to: u.rows[0].email, subject, template, data: { name: u.rows[0].name, ...data } });
  } catch (_) { /* best-effort */ }
}

const service = {
  async create(data, userId) {
    const buyerId = await resolveAccountId(userId);
    const rmaNo = await repo.nextRmaNumber();
    // Header + items insert must be atomic (Finding S02) — run both through the
    // same tx client instead of passing null, which let each INSERT commit on
    // its own connection with no rollback if the second one failed.
    let rma;
    await tx(async (client) => {
      rma = await repo.create(client, {
        rma_no: rmaNo,
        order_id: data.order_id,
        order_item_id: data.order_item_id,
        quantity: data.quantity,
        buyer_id: buyerId,
        reason_category: data.return_type,
        reason_detail: data.reason,
      });
    });
    await notifyBuyer(buyerId, 'RMA Received', 'rma_received', { rmaNumber: rmaNo, reason: data.reason });
    return rma;
  },

  async list(queryParams, userId, isAdmin) {
    const o = paginate(queryParams);
    const buyerId = isAdmin ? null : await resolveAccountId(userId);
    const { rows, total } = await repo.findAll(buyerId, isAdmin, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async get(id, userId, isAdmin) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    if (!isAdmin) {
      const buyerId = await resolveAccountId(userId);
      if (r.buyer_id !== buyerId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    return r;
  },

  async approve(id, actor, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'APPROVED', role);
    await tx(async (client) => {
      // Lock + conditionally transition so concurrent approve calls on the same RMA
      // serialize instead of both passing the pre-transaction status check and both
      // writing decided_by/decided_at + firing a duplicate approval email (FINDING-S01;
      // reproduced with 10-way concurrent requests giving 4 "successful" approvals).
      const locked = await repo.lockForUpdate(client, id);
      if (locked) assertTransition('RMA', locked.status, 'APPROVED', role);
      const updated = locked && await repo.transitionStatus(client, id, locked.status, 'APPROVED');
      if (!updated) throw new AppError('INVALID_TRANSITION', 'RMA was already processed by another request', 409);
      await client.query(`UPDATE rma_requests SET decided_by = $1, decided_at = NOW() WHERE id = $2`, [actor, id]);
      await writeAudit({ actor, action: 'RMA_APPROVED', entity: 'rma_requests', entityId: String(id) }, client);
    });
    await notifyBuyer(r.buyer_id, 'RMA Approved', 'rma_decision', { rmaNumber: r.rma_no, decision: 'approved' });
  },

  async reject(id, data, actor, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'REJECTED', role);
    await tx(async (client) => {
      const locked = await repo.lockForUpdate(client, id);
      if (locked) assertTransition('RMA', locked.status, 'REJECTED', role);
      const updated = locked && await repo.transitionStatus(client, id, locked.status, 'REJECTED');
      if (!updated) throw new AppError('INVALID_TRANSITION', 'RMA was already processed by another request', 409);
      await client.query(`UPDATE rma_requests SET decided_by = $1, decided_at = NOW(), resolution = $2 WHERE id = $3`, [actor, data.reason, id]);
      await writeAudit({ actor, action: 'RMA_REJECTED', entity: 'rma_requests', entityId: String(id), after: { reason: data.reason } }, client);
    });
    await notifyBuyer(r.buyer_id, 'RMA Declined', 'rma_decision', { rmaNumber: r.rma_no, decision: 'declined', reason: data.reason });
  },

  async receive(id, data, actor, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'ITEM_RECEIVED', role);

    await tx(async (client) => {
      // Lock + conditionally transition (FINDING-S01) — reproduced with 10-way concurrent
      // receive calls crediting stock 4x (8 units instead of 2) before this fix. Re-running
      // assertTransition against the post-lock status (not the pre-tx read) is what makes a
      // second concurrent caller see the now-current status and fail cleanly instead of the
      // transitionStatus guard trivially matching itself (e.g. ITEM_RECEIVED -> ITEM_RECEIVED).
      const locked = await repo.lockForUpdate(client, id);
      if (locked) assertTransition('RMA', locked.status, 'ITEM_RECEIVED', role);
      const updated = locked && await repo.transitionStatus(client, id, locked.status, 'ITEM_RECEIVED');
      if (!updated) throw new AppError('INVALID_TRANSITION', 'RMA was already processed by another request', 409);
      await client.query(`UPDATE rma_requests SET inventory_adjustment_note = $1 WHERE id = $2`, [data.notes || data.disposition, id]);

      const movType = data.disposition === 'WRITE_OFF' ? 'DAMAGE_WRITE_OFF' : 'RMA_RETURN';
      for (const item of r.items) {
        await client.query(
          `INSERT INTO stock_movements (product_id, movement_type, qty, note, ref_table, ref_id, performed_by)
           SELECT oi.product_id, $1, $2, $3, 'rma_requests', $4, $5 FROM order_items oi WHERE oi.id = $6`,
          [movType, item.qty, data.notes || null, String(id), actor, item.order_item_id]
        );
        if (data.disposition !== 'WRITE_OFF') {
          await client.query(
            `UPDATE products SET stock_qty = stock_qty + $1, updated_at = NOW()
             WHERE id = (SELECT product_id FROM order_items WHERE id = $2)`,
            [item.qty, item.order_item_id]
          );
        }
      }
      await writeAudit({ actor, action: 'RMA_ITEM_RECEIVED', entity: 'rma_requests', entityId: String(id), after: { disposition: data.disposition } }, client);
    });
  },

  async resolve(id, data, actor, role) {
    const r = await repo.findById(id);
    if (!r) throw new AppError('NOT_FOUND', 'RMA not found', 404);
    assertTransition('RMA', r.status, 'RESOLVED', role);

    await tx(async (client) => {
      // Lock + conditionally transition (FINDING-S01) — without this, concurrent resolve
      // calls could double-insert an invoice_adjustments credit note for the same RMA.
      const locked = await repo.lockForUpdate(client, id);
      if (locked) assertTransition('RMA', locked.status, 'RESOLVED', role);
      const updated = locked && await repo.transitionStatus(client, id, locked.status, 'RESOLVED');
      if (!updated) throw new AppError('INVALID_TRANSITION', 'RMA was already processed by another request', 409);
      await client.query(`UPDATE rma_requests SET resolution = $1 WHERE id = $2`, [data.resolution, id]);

      if (data.adjustment_amount > 0) {
        const invoice = await client.query('SELECT id, total_amount, paid_amount FROM invoices WHERE order_id = $1 LIMIT 1', [r.order_id]);
        if (invoice.rows.length) {
          const inv = invoice.rows[0];
          await client.query(
            `INSERT INTO invoice_adjustments (invoice_id, amount, reason, rma_id, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [inv.id, data.adjustment_amount, data.notes || 'RMA Resolution', id, actor]
          );
          await client.query(`UPDATE rma_requests SET invoice_adjustment_note = $1 WHERE id = $2`, [`Credit note ${data.adjustment_amount}`, id]);

          // Re-fold this credit note into the invoice's own balance/status (Finding: RMA credit
          // notes were only ever recorded in invoice_adjustments, never reflected on the invoice
          // itself, so it stayed PAID/balance_due=0 forever). Adjustments are credits, so they
          // reduce what's owed — same sign convention the Statement ledger already uses.
          const creditTotalRes = await client.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM invoice_adjustments WHERE invoice_id = $1', [inv.id]
          );
          const creditTotal = Number(creditTotalRes.rows[0].total);
          const paidAmount = Number(inv.paid_amount);
          const totalAmount = Number(inv.total_amount);
          const newBalance = Math.round((totalAmount - paidAmount - creditTotal) * 100) / 100;
          const newStatus = newBalance <= 0
            ? (paidAmount > 0 ? 'ADJUSTED' : 'CANCELLED')
            : (paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING');
          await client.query(
            'UPDATE invoices SET balance_due = $1, status = $2, updated_at = NOW() WHERE id = $3',
            [newBalance, newStatus, inv.id]
          );
        }
      }
      await writeAudit({ actor, action: 'RMA_RESOLVED', entity: 'rma_requests', entityId: String(id), after: { resolution: data.resolution } }, client);
    });
    await notifyBuyer(r.buyer_id, 'RMA Resolved', 'rma_resolved', { rmaNumber: r.rma_no, resolution: data.resolution, adjustmentAmount: data.adjustment_amount || 0 });
  },
};
module.exports = service;
