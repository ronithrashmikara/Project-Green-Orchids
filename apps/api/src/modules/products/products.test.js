const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;
let productId;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');

  const meta = await req(ctx.baseUrl, 'GET', '/products/meta/categories', { token: adminToken });
  const category = meta.data.data[0];
  const supplierList = await req(ctx.baseUrl, 'GET', '/suppliers?limit=1', { token: adminToken });
  const supplier = supplierList.data.data[0];

  const created = await req(ctx.baseUrl, 'POST', '/products', {
    token: adminToken,
    body: {
      sku: `AUTOTEST-${Date.now()}`, name: 'Automated Test Orchid', category_id: category.id, supplier_id: supplier.id,
      product_type: 'ORCHID', base_price: 5000, moq: 2, stock_qty: 100, reorder_level: 10,
    },
  });
  assert.equal(created.status, 201);
  productId = created.data.data.id;
});

after(async () => {
  // Mark discontinued instead of a hard delete, consistent with how the app itself
  // avoids destructive deletes against append-only price/movement history.
  await req(ctx.baseUrl, 'PATCH', `/products/${productId}`, { token: adminToken, body: { status: 'DISCONTINUED' } }).catch(() => {});
  await ctx.close();
});

test('price governance: the third price change within 24h requires admin approval instead of applying immediately', async () => {
  const first = await req(ctx.baseUrl, 'POST', `/products/${productId}/price-change`, { token: adminToken, body: { new_price: 5100, reason: 'test 1' } });
  assert.equal(first.status, 200);
  assert.equal(first.data.data.applied, true);

  const second = await req(ctx.baseUrl, 'POST', `/products/${productId}/price-change`, { token: adminToken, body: { new_price: 5200, reason: 'test 2' } });
  assert.equal(second.data.data.applied, true);

  const third = await req(ctx.baseUrl, 'POST', `/products/${productId}/price-change`, { token: adminToken, body: { new_price: 5300, reason: 'test 3' } });
  assert.equal(third.data.data.applied, false);
  assert.equal(third.data.data.needs_approval, true);

  const priceAfter = await req(ctx.baseUrl, 'GET', `/products/${productId}`, { token: adminToken });
  assert.equal(Number(priceAfter.data.data.basePrice), 5200, 'the pending 3rd change should not have applied yet');

  // The governance notification should reach a real admin recipient (regression from the
  // first QA cycle: this used to be enqueued with recipientEmail: null).
  const outbox = await req(ctx.baseUrl, 'GET', '/notifications/outbox?limit=20', { token: adminToken });
  const notif = outbox.data.data.find((o) => o.template === 'price_approval_needed');
  assert.ok(notif, 'a price_approval_needed notification should be enqueued');
  assert.ok(notif.recipient_email, 'the notification must have a real admin recipient');
});

test('a non-admin cannot create products', async () => {
  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const { status } = await req(ctx.baseUrl, 'POST', '/products', {
    token: buyerToken, body: { sku: 'SHOULD-FAIL', name: 'x', category_id: 1, supplier_id: 1, product_type: 'ORCHID', base_price: 100, moq: 1, stock_qty: 1, reorder_level: 1 },
  });
  assert.equal(status, 403);
});
