const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let buyerToken;
let adminToken;
let inventoryToken;
let financeToken;
let order;
let invoice;
let orderItem;

before(async () => {
  ctx = await startServer();
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  adminToken = await login(ctx.baseUrl, 'admin');
  inventoryToken = await login(ctx.baseUrl, 'inventory');
  financeToken = await login(ctx.baseUrl, 'finance');

  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  const product = data.products.find((p) => p.status === 'ACTIVE' && p.available >= p.moq * 5);
  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  await req(ctx.baseUrl, 'POST', '/cart/items', { token: buyerToken, body: { product_id: product.id, quantity: product.moq * 5 } });
  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  order = created.data.data;
  await req(ctx.baseUrl, 'PATCH', `/orders/${order.id}/approve`, { token: adminToken, body: {} });

  const detail = await req(ctx.baseUrl, 'GET', `/orders/${order.id}`, { token: buyerToken });
  orderItem = detail.data.data.items[0];

  const invoices = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${order.id}`, { token: buyerToken });
  invoice = invoices.data.data.find((i) => i.order_id === order.id);

  // Fully pay the invoice up front so the credit-note regression below is unambiguous: an
  // already-PAID invoice must stop being misleadingly "PAID" once a credit is issued against it.
  await req(ctx.baseUrl, 'POST', '/payments', {
    token: financeToken, body: { invoice_id: invoice.id, amount: Number(invoice.total_amount), method: 'BANK_TRANSFER', reference: 'TEST-RMA-PREPAY' },
  });
});

after(async () => { await ctx.close(); });

test('golden path: RMA create -> admin approve -> inventory receives (restock) -> resolve with credit note updates the real invoice balance (regression: BUG-001)', async () => {
  const stockBefore = await req(ctx.baseUrl, 'GET', `/products/${orderItem.product_id}`, { token: adminToken });
  const stockQtyBefore = stockBefore.data.data.stock;

  const returnQty = 2;
  const created = await req(ctx.baseUrl, 'POST', '/rma', {
    token: buyerToken,
    body: {
      order_id: order.id, order_item_id: orderItem.id, quantity: returnQty,
      reason: 'automated test: units arrived damaged in transit', return_type: 'DAMAGED',
    },
  });
  assert.equal(created.status, 201);
  const rma = created.data.data;

  const approved = await req(ctx.baseUrl, 'PATCH', `/rma/${rma.id}/approve`, { token: adminToken, body: {} });
  assert.equal(approved.status, 200);

  const received = await req(ctx.baseUrl, 'PATCH', `/rma/${rma.id}/receive`, { token: inventoryToken, body: { disposition: 'RESTOCK' } });
  assert.equal(received.status, 200);

  const stockAfter = await req(ctx.baseUrl, 'GET', `/products/${orderItem.product_id}`, { token: adminToken });
  assert.equal(stockAfter.data.data.stock, stockQtyBefore + returnQty, 'restocking an RMA should increase stock by the returned quantity');

  const invoiceBeforeCredit = await req(ctx.baseUrl, 'GET', `/invoices/${invoice.id}`, { token: financeToken });
  assert.equal(invoiceBeforeCredit.data.data.status, 'PAID');
  const balanceBefore = Number(invoiceBeforeCredit.data.data.balance_due);

  const creditAmount = Number(orderItem.unit_price_at_order) * returnQty;
  const resolved = await req(ctx.baseUrl, 'PATCH', `/rma/${rma.id}/resolve`, {
    token: adminToken, body: { resolution: 'CREDIT_NOTE', adjustment_amount: creditAmount, notes: 'automated test credit' },
  });
  assert.equal(resolved.status, 200);

  const invoiceAfterCredit = await req(ctx.baseUrl, 'GET', `/invoices/${invoice.id}`, { token: financeToken });
  const balanceAfter = Number(invoiceAfterCredit.data.data.balance_due);
  assert.equal(balanceAfter, Math.round((balanceBefore - creditAmount) * 100) / 100,
    'balance_due must actually drop by the credit amount instead of staying frozen at PAID/0');
});

test('regression (FINDING-S01): concurrent RMA approve only processes once', async () => {
  const created = await req(ctx.baseUrl, 'POST', '/rma', {
    token: buyerToken,
    body: { order_id: order.id, order_item_id: orderItem.id, quantity: 1, reason: 'automated test: concurrency check on approve', return_type: 'DAMAGED' },
  });
  const rma = created.data.data;

  // Before locking the RMA row inside the transaction, this raced: with enough concurrent
  // requests (10-way), 3-4 "successful" approvals landed on the same PENDING RMA, each
  // overwriting decided_by/decided_at and firing a duplicate approval email.
  const results = await Promise.all(
    Array.from({ length: 10 }, () => req(ctx.baseUrl, 'PATCH', `/rma/${rma.id}/approve`, { token: adminToken, body: {} }))
  );
  const successes = results.filter((r) => r.status === 200);
  assert.equal(successes.length, 1, 'exactly one approve should succeed out of 10 concurrent attempts');
  const failures = results.filter((r) => r.status !== 200);
  for (const f of failures) assert.equal(f.status, 409);
});

test('regression (FINDING-S01): concurrent RMA receive only credits stock once', async () => {
  const returnQty = 2;
  const created = await req(ctx.baseUrl, 'POST', '/rma', {
    token: buyerToken,
    body: { order_id: order.id, order_item_id: orderItem.id, quantity: returnQty, reason: 'automated test: concurrency check on receive', return_type: 'DAMAGED' },
  });
  const rma = created.data.data;
  await req(ctx.baseUrl, 'PATCH', `/rma/${rma.id}/approve`, { token: adminToken, body: {} });

  const stockBefore = await req(ctx.baseUrl, 'GET', `/products/${orderItem.product_id}`, { token: adminToken });
  const stockQtyBefore = stockBefore.data.data.stock;

  // Before locking the RMA row inside the transaction, this raced: with enough concurrent
  // requests (10-way), 4 "successful" receives landed on the same APPROVED RMA, quadrupling
  // the stock credit (8 units instead of 2) for a single physical return.
  const results = await Promise.all(
    Array.from({ length: 10 }, () => req(ctx.baseUrl, 'PATCH', `/rma/${rma.id}/receive`, { token: inventoryToken, body: { disposition: 'RESTOCK' } }))
  );
  const successes = results.filter((r) => r.status === 200);
  assert.equal(successes.length, 1, 'exactly one receive should succeed out of 10 concurrent attempts');

  const stockAfter = await req(ctx.baseUrl, 'GET', `/products/${orderItem.product_id}`, { token: adminToken });
  assert.equal(stockAfter.data.data.stock, stockQtyBefore + returnQty, 'stock should be credited exactly once, not once per concurrent request');
});
