const { tx } = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { assertTransition } = require('../../utils/stateMachine');
const { calculateLineTotal, calculateOrderTotal } = require('../../utils/money');
const { paginate } = require('../../utils/pagination');
const { enqueueEmail } = require('../../utils/outbox');
const { dueDateForTerm } = require('../../utils/time');
const repo = require('./orders.repository');

// available stock = stock_qty - reserved_qty  (the plan's core invariant)
const available = (p) => Number(p.stock_qty) - Number(p.reserved_qty || 0);

const service = {
  async createFromCart(userId, data) {
    const acct = await repo.accountIdForUser(userId);
    if (!acct) throw new AppError('NO_ACCOUNT', 'No trade account for this user', 403);
    const accountId = acct.id;

    const cartItems = await repo.getCartItems(null, accountId);
    if (!cartItems.length) throw new AppError('EMPTY_CART', 'Cart is empty', 400);

    // Validate status / MOQ / availability (availability = stock - reserved)
    for (const item of cartItems) {
      if (item.status !== 'ACTIVE') throw new AppError('PRODUCT_INACTIVE', `${item.name} is no longer active`, 400);
      if (item.quantity < item.moq) throw new AppError('BELOW_MOQ', `${item.name} minimum order is ${item.moq}`, 400);
      if (item.quantity > available(item)) throw new AppError('INSUFFICIENT_STOCK', `${item.name} only has ${available(item)} available`, 400);
    }

    const tierRate = await repo.getBuyerTierDiscount(accountId);
    const orderItems = cartItems.map(item => ({
      quantity: item.quantity,
      unit_price: Number(item.base_price),
      product_id: item.product_id,
      price_source: 'BASE',
      line_total: calculateLineTotal(item.quantity, Number(item.base_price)),
    }));

    const { subtotal, tierDiscountAmount, total } = calculateOrderTotal(orderItems, tierRate);
    const orderNumber = await repo.nextOrderNumber();

    let order;
    await tx(async (client) => {
      order = await repo.create(client, {
        order_no: orderNumber, buyer_id: accountId, source: 'CART',
        subtotal, tier_discount_amount: tierDiscountAmount, total,
      });
      for (const item of orderItems) {
        await repo.createOrderItem(client, {
          order_id: order.id, product_id: item.product_id, qty: item.quantity,
          unit_price: item.unit_price, price_source: item.price_source, line_total: item.line_total,
        });
      }
      await repo.clearCart(client, accountId);
      // Outbox enqueue inside the same txn (Finding 22)
      await enqueueEmail(client, {
        recipientEmail: acct.email || null, recipientUserId: userId, template: 'order_submitted',
        payload: { orderNumber, totalAmount: total.toFixed(2), itemCount: cartItems.length },
      });
    });
    return order;
  },

  async createFromRfq(userId, rfqId) {
    const acct = await repo.accountIdForUser(userId);
    if (!acct) throw new AppError('NO_ACCOUNT', 'No trade account for this user', 403);
    const accountId = acct.id;

    const rfqRepo = require('../rfq/rfq.repository');
    const rfq = await rfqRepo.findById(rfqId);
    if (!rfq) throw new AppError('NOT_FOUND', 'RFQ not found', 404);
    if (rfq.buyer_id !== accountId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    if (rfq.status !== 'ACCEPTED') throw new AppError('INVALID_STATE', 'RFQ must be accepted', 409);

    const items = await rfqRepo.findItems(rfqId);
    const orderNumber = await repo.nextOrderNumber();

    // RFQ-quoted lines take quoted_unit_price verbatim; NO tier discount (F1.2)
    const orderItems = items.map(item => {
      const unit = Number(item.quoted_unit_price);
      return {
        quantity: item.requested_qty, unit_price: unit, product_id: item.product_id,
        price_source: 'RFQ_QUOTE', line_total: calculateLineTotal(item.requested_qty, unit),
      };
    });
    const { subtotal, total } = calculateOrderTotal(orderItems, 0);

    // Per-line availability warnings on conversion (F3.3) — informational, admin is the stock gate
    const warnings = [];
    let order;
    await tx(async (client) => {
      order = await repo.create(client, {
        order_no: orderNumber, buyer_id: accountId, source: 'RFQ_CONVERSION', rfq_id: rfqId,
        subtotal, tier_discount_amount: 0, total,
      });
      for (const item of orderItems) {
        await repo.createOrderItem(client, {
          order_id: order.id, product_id: item.product_id, qty: item.quantity,
          unit_price: item.unit_price, price_source: 'RFQ_QUOTE', line_total: item.line_total,
        });
      }
      await rfqRepo.updateStatus(client, rfqId, 'CONVERTED');
    });

    // Compute availability warnings after creation (read-only)
    for (const item of orderItems) {
      const prodRows = await require('../../config/db').query(
        'SELECT name, stock_qty, reserved_qty FROM products WHERE id = $1', [item.product_id]);
      if (prodRows.rows.length) {
        const p = prodRows.rows[0];
        const avail = Number(p.stock_qty) - Number(p.reserved_qty || 0);
        if (avail < item.quantity) warnings.push({ product: p.name, requested: item.quantity, available: avail });
      }
    }
    return { ...order, availabilityWarnings: warnings };
  },

  async list(queryParams, userId, isAdmin) {
    const o = paginate(queryParams);
    const filters = { status: queryParams.status };
    let accountId = null;
    if (!isAdmin) { const acct = await repo.accountIdForUser(userId); accountId = acct ? acct.id : '00000000-0000-0000-0000-000000000000'; }
    const { rows, total } = await repo.findAll(accountId, isAdmin, filters, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async get(id, userId, isAdmin) {
    const order = await repo.findById(id);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    if (!isAdmin) {
      const acct = await repo.accountIdForUser(userId);
      if (!acct || order.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    const items = await repo.findItems(id);
    return { ...order, items };
  },

  async approve(id, actor) {
    const order = await repo.findById(id);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    assertTransition('ORDER', order.status, 'APPROVED', 'ADMIN');
    const items = await repo.findItems(id);

    await tx(async (client) => {
      const productIds = items.map(i => i.product_id);
      const locked = await repo.lockProductsForUpdate(client, productIds);
      const map = {};
      for (const p of locked) map[p.id] = p;

      // Re-verify availability = stock_qty - reserved_qty (Finding 7)
      for (const item of items) {
        const p = map[item.product_id];
        if (!p) throw new AppError('PRODUCT_NOT_FOUND', `Product ${item.product_id} not found`, 404);
        const avail = Number(p.stock_qty) - Number(p.reserved_qty || 0);
        if (avail < item.quantity) throw new AppError('INSUFFICIENT_STOCK', `Product has only ${avail} available, requested ${item.quantity}`, 409);
      }

      // Credit check (available = credit_limit - outstanding)
      const creditOk = await repo.checkCredit(client, order.buyer_id, Number(order.total));
      if (!creditOk) throw new AppError('CREDIT_LIMIT_EXCEEDED', 'Buyer does not have sufficient credit', 409);

      // Reserve (bump reserved_qty) + ledger movement
      for (const item of items) {
        const p = map[item.product_id];
        await repo.reserveStock(client, item.product_id, item.quantity);
        await repo.createStockMovement(client, {
          product_id: item.product_id, movement_type: 'ORDER_RESERVE', qty: item.quantity,
          ref_table: 'orders', ref_id: id, performed_by: actor, note: `Order ${order.order_no}`,
        });
      }

      // Invoice with term-correct due date (Finding 12) + balance_due
      const invoiceNumber = await repo.nextInvoiceNumber();
      const dueDate = dueDateForTerm(order.payment_term);
      await repo.createInvoice(client, {
        invoice_no: invoiceNumber, order_id: id, buyer_id: order.buyer_id,
        total_amount: order.total, due_date: dueDate,
      });

      await repo.updateStatus(client, id, 'APPROVED');
      await writeAudit({ actor, action: 'ORDER_APPROVED', entityType: 'orders', entityId: String(id),
        before: { status: order.status }, after: { status: 'APPROVED' } }, client);
      await enqueueEmail(client, {
        recipientEmail: order.buyer_email, recipientUserId: order.buyer_user_id, template: 'order_approved',
        payload: { orderNumber: order.order_no, totalAmount: Number(order.total).toFixed(2), invoiceNumber },
      });
    });
  },

  async reject(id, data, actor) {
    const order = await repo.findById(id);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    assertTransition('ORDER', order.status, 'REJECTED', 'ADMIN');
    await tx(async (client) => {
      await repo.setRejected(client, id, data.reason);
      await writeAudit({ actor, action: 'ORDER_REJECTED', entityType: 'orders', entityId: String(id),
        before: { status: order.status }, after: { status: 'REJECTED', reason: data.reason } }, client);
      await enqueueEmail(client, { recipientEmail: order.buyer_email, recipientUserId: order.buyer_user_id,
        template: 'order_rejected', payload: { orderNumber: order.order_no, reason: data.reason } });
    });
  },

  async cancel(id, data, actor) {
    const order = await repo.findById(id);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    // Role detection by resolving the caller's trade-account id (Finding 15)
    const acct = await repo.accountIdForUser(actor);
    const role = (acct && acct.id === order.buyer_id) ? 'BUYER' : 'ADMIN';
    assertTransition('ORDER', order.status, 'CANCELLED', role);

    await tx(async (client) => {
      if (order.status === 'APPROVED') {
        const items = await repo.findItems(id);
        for (const item of items) {
          await repo.releaseReservation(client, item.product_id, item.quantity);
          await repo.createStockMovement(client, {
            product_id: item.product_id, movement_type: 'ORDER_RELEASE', qty: item.quantity,
            ref_table: 'orders', ref_id: id, performed_by: actor, note: `Cancel ${order.order_no}`,
          });
        }
      }
      await repo.setCancelled(client, id, data.reason, actor);
      await writeAudit({ actor, action: 'ORDER_CANCELLED', entityType: 'orders', entityId: String(id),
        before: { status: order.status }, after: { status: 'CANCELLED', reason: data.reason } }, client);
      await enqueueEmail(client, { recipientEmail: order.buyer_email, recipientUserId: order.buyer_user_id,
        template: 'order_cancelled', payload: { orderNumber: order.order_no } });
    });
  },

  async confirmReceipt(id, userId) {
    const order = await repo.findById(id);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    const acct = await repo.accountIdForUser(userId);
    if (!acct || order.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);
    assertTransition('ORDER', order.status, 'CLOSED', 'BUYER');
    await tx(async (client) => {
      await repo.updateStatus(client, id, 'CLOSED');
      await writeAudit({ actor: userId, action: 'ORDER_CONFIRMED', entityType: 'orders', entityId: String(id),
        before: { status: order.status }, after: { status: 'CLOSED' } }, client);
    });
  },

  async requestReturn(id, userId, data) {
    const order = await repo.findById(id);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    const acct = await repo.accountIdForUser(userId);
    if (!acct || order.buyer_id !== acct.id) throw new AppError('FORBIDDEN', 'Access denied', 403);

    const items = await repo.findItems(id);
    const orderItem = items.find(i => i.id === data.order_item_id);
    if (!orderItem) throw new AppError('NOT_FOUND', 'Order item not found', 404);
    if (data.quantity > orderItem.quantity) throw new AppError('INVALID_QTY', 'Return quantity exceeds delivered', 422);

    const rmaService = require('../rma/rma.service');
    return rmaService.create({
      order_id: id, order_item_id: data.order_item_id, quantity: data.quantity,
      reason: data.reason, return_type: data.return_type,
    }, acct.id);
  },
};
module.exports = service;
