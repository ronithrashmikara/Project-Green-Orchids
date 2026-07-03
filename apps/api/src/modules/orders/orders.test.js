const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let buyerToken;
let adminToken;
let product;
let order;

before(async () => {
  ctx = await startServer();
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  adminToken = await login(ctx.baseUrl, 'admin');

  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  product = data.products.find((p) => p.status === 'ACTIVE' && p.available >= p.moq * 2);
  assert.ok(product, 'seed data should include an ACTIVE product with enough available stock');
});

after(async () => { await ctx.close(); });

test('golden path: catalogue -> cart -> order -> admin approve -> stock reservation -> invoice', async () => {
  const add = await req(ctx.baseUrl, 'POST', '/cart/items', {
    token: buyerToken, body: { product_id: product.id, quantity: product.moq },
  });
  assert.equal(add.status, 201);

  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  assert.equal(created.status, 201);
  order = created.data.data;
  assert.equal(order.status, 'PENDING_APPROVAL');
  assert.equal(order.approved_by, null);

  const beforeReserve = await req(ctx.baseUrl, 'GET', `/products/${product.id}`, { token: buyerToken });
  const reservedBefore = beforeReserve.data.data.reserved;

  const approved = await req(ctx.baseUrl, 'PATCH', `/orders/${order.id}/approve`, { token: adminToken, body: {} });
  assert.equal(approved.status, 200);

  // Regression: approve() must persist who/when, not just flip the status.
  const orderAfter = await req(ctx.baseUrl, 'GET', `/orders/${order.id}`, { token: adminToken });
  assert.equal(orderAfter.data.data.status, 'APPROVED');
  assert.ok(orderAfter.data.data.approved_by, 'approved_by should be set after approval');
  assert.ok(orderAfter.data.data.approved_at, 'approved_at should be set after approval');

  const afterReserve = await req(ctx.baseUrl, 'GET', `/products/${product.id}`, { token: buyerToken });
  assert.equal(afterReserve.data.data.reserved, reservedBefore + product.moq, 'reserved should increase by the ordered quantity');

  const invoices = await req(ctx.baseUrl, 'GET', `/invoices?order_id=${order.id}`, { token: buyerToken });
  const invoice = (invoices.data.data || []).find((i) => i.order_id === order.id);
  assert.ok(invoice, 'approving an order should generate an invoice for it');
  assert.equal(invoice.status, 'PENDING');
  assert.equal(Number(invoice.balance_due), Number(invoice.total_amount));
});

test('a buyer cannot approve their own order, and cannot see another buyer\'s order', async () => {
  const buyer2Token = await login(ctx.baseUrl, 'buyer2');

  const selfApprove = await req(ctx.baseUrl, 'PATCH', `/orders/${order.id}/approve`, { token: buyerToken, body: {} });
  assert.equal(selfApprove.status, 403);

  const crossBuyer = await req(ctx.baseUrl, 'GET', `/orders/${order.id}`, { token: buyer2Token });
  assert.equal(crossBuyer.status, 403);
});

test('submitting an order with an empty cart is rejected', async () => {
  const buyer3Token = await login(ctx.baseUrl, 'buyer2');
  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyer3Token });
  const { status } = await req(ctx.baseUrl, 'POST', '/orders', { token: buyer3Token, body: {} });
  assert.ok(status >= 400, 'ordering with nothing in the cart should not succeed');
});

test('a bad/nonexistent order id returns a clean 404, not a crash', async () => {
  const { status, data } = await req(ctx.baseUrl, 'GET', '/orders/999999999', { token: adminToken });
  assert.equal(status, 404);
  assert.equal(data.error.code, 'NOT_FOUND');
});
