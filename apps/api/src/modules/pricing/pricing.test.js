const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;
let inventoryToken;
let productId;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');
  inventoryToken = await login(ctx.baseUrl, 'inventory');

  const meta = await req(ctx.baseUrl, 'GET', '/products/meta/categories', { token: adminToken });
  const category = meta.data.data[0];
  const supplierList = await req(ctx.baseUrl, 'GET', '/suppliers?limit=1', { token: adminToken });
  const supplier = supplierList.data.data[0];

  const created = await req(ctx.baseUrl, 'POST', '/products', {
    token: adminToken,
    body: {
      sku: `PRICING-TEST-${Date.now()}`, name: 'Pricing Governance Test Orchid', category_id: category.id, supplier_id: supplier.id,
      product_type: 'ORCHID', base_price: 1000, moq: 1, stock_qty: 50, reorder_level: 5,
    },
  });
  productId = created.data.data.id;

  // Two changes apply immediately; the third is parked pending approval.
  await req(ctx.baseUrl, 'POST', `/products/${productId}/price-change`, { token: adminToken, body: { new_price: 1100, reason: 'first automated test change' } });
  await req(ctx.baseUrl, 'POST', `/products/${productId}/price-change`, { token: adminToken, body: { new_price: 1200, reason: 'second automated test change' } });
  await req(ctx.baseUrl, 'POST', `/products/${productId}/price-change`, { token: adminToken, body: { new_price: 1300, reason: 'third automated test change' } });
});

after(async () => {
  await req(ctx.baseUrl, 'PATCH', `/products/${productId}`, { token: adminToken, body: { status: 'DISCONTINUED' } }).catch(() => {});
  await ctx.close();
});

test('a pending price-change request shows up in the governance queue and can be approved, applying the new price', async () => {
  const pending = await req(ctx.baseUrl, 'GET', '/pricing/requests', { token: adminToken });
  assert.equal(pending.status, 200);
  const request = pending.data.data.find((r) => r.product_id === productId);
  assert.ok(request, 'the parked 3rd price change should appear in the pending requests queue');

  // Approved by inventory (also holds price.approve), not the admin who requested it — the
  // requesting admin approving their own request is correctly rejected as SELF_APPROVAL.
  const selfApprove = await req(ctx.baseUrl, 'PATCH', `/pricing/requests/${request.id}/approve`, { token: adminToken, body: {} });
  assert.equal(selfApprove.status, 403);

  const approved = await req(ctx.baseUrl, 'PATCH', `/pricing/requests/${request.id}/approve`, { token: inventoryToken, body: {} });
  assert.equal(approved.status, 200);

  const product = await req(ctx.baseUrl, 'GET', `/products/${productId}`, { token: adminToken });
  assert.equal(Number(product.data.data.basePrice), 1300, 'approving the pending request should apply the new price');

  const history = await req(ctx.baseUrl, 'GET', '/pricing/history', { token: adminToken });
  assert.equal(history.status, 200);
});

test('a plain buyer cannot approve price changes', async () => {
  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const { status } = await req(ctx.baseUrl, 'GET', '/pricing/requests', { token: buyerToken });
  assert.equal(status, 403);
});
