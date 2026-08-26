const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let buyerToken;
let otherBuyerToken;
let financeToken;
let adminToken;
let deliveryToken;
let deliveryUserId;
let delivery;

before(async () => {
  ctx = await startServer();
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  otherBuyerToken = await login(ctx.baseUrl, 'buyer2');
  financeToken = await login(ctx.baseUrl, 'finance');
  adminToken = await login(ctx.baseUrl, 'admin');
  deliveryToken = await login(ctx.baseUrl, 'delivery');

  const me = await req(ctx.baseUrl, 'GET', '/auth/me', { token: deliveryToken });
  deliveryUserId = me.data.data.id;

  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  // Pick a product with REAL availability (stock − reserved ≥ moq) — the newest
  // ACTIVE product can be fully reserved, which made this fixture order-flaky.
  const candidates = (data.products || []).filter((p) => p.status === 'ACTIVE'
    && Number(p.available ?? p.stock ?? 0) >= (p.moq || 1));
  const product = candidates[0];
  assert.ok(product, 'catalogue fixture needs at least one available product');
  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  const added = await req(ctx.baseUrl, 'POST', '/cart/items', { token: buyerToken, body: { product_id: product.id, quantity: product.moq } });
  assert.equal(added.status, 201, 'cart add should succeed for an available product');
  const created = await req(ctx.baseUrl, 'POST', '/orders', { token: buyerToken, body: {} });
  const order = created.data.data;
  await req(ctx.baseUrl, 'PATCH', `/orders/${order.id}/approve`, { token: adminToken, body: {} });

  const list = await req(ctx.baseUrl, 'GET', `/deliveries?status=PENDING`, { token: adminToken });
  delivery = list.data.find((d) => d.order_id === order.id);
  assert.ok(delivery, 'approving an order should have created a PENDING delivery for it');
});

after(async () => { await ctx.close(); });

test('regression (BUG-009): assigning to a non-coordinator or nonexistent user is rejected cleanly, not a raw 500', async () => {
  const meBuyer = await req(ctx.baseUrl, 'GET', '/auth/me', { token: buyerToken });

  const wrongRole = await req(ctx.baseUrl, 'PATCH', `/deliveries/${delivery.id}/assign`, {
    token: adminToken, body: { assignedTo: meBuyer.data.data.id },
  });
  assert.equal(wrongRole.status, 400);
  assert.equal(wrongRole.data.error.code, 'INVALID_ASSIGNEE');

  const nonexistent = await req(ctx.baseUrl, 'PATCH', `/deliveries/${delivery.id}/assign`, {
    token: adminToken, body: { assignedTo: '00000000-0000-0000-0000-000000000099' },
  });
  assert.equal(nonexistent.status, 400);
  assert.equal(nonexistent.data.error.code, 'INVALID_ASSIGNEE');

  const malformed = await req(ctx.baseUrl, 'PATCH', `/deliveries/${delivery.id}/assign`, {
    token: adminToken, body: { assignedTo: 'not-a-uuid' },
  });
  assert.equal(malformed.status, 422);
});

test('buyers can only list and open delivery records that belong to their own trade account', async () => {
  const ownList = await req(ctx.baseUrl, 'GET', '/deliveries', { token: buyerToken });
  assert.ok(ownList.data.some((row) => row.id === delivery.id));

  const otherList = await req(ctx.baseUrl, 'GET', '/deliveries', { token: otherBuyerToken });
  assert.ok(!otherList.data.some((row) => row.id === delivery.id));

  const otherGet = await req(ctx.baseUrl, 'GET', `/deliveries/${delivery.id}`, { token: otherBuyerToken });
  assert.equal(otherGet.status, 403);

  const otherPod = await req(ctx.baseUrl, 'GET', `/deliveries/${delivery.id}/pod-file`, { token: otherBuyerToken });
  assert.equal(otherPod.status, 403);

  const unrelatedStaffPod = await req(ctx.baseUrl, 'GET', `/deliveries/${delivery.id}/pod-file`, { token: financeToken });
  assert.equal(unrelatedStaffPod.status, 403);
});

test('golden path: assign -> dispatch -> in-transit -> POD upload -> buyer confirms receipt', async () => {
  const assign = await req(ctx.baseUrl, 'PATCH', `/deliveries/${delivery.id}/assign`, {
    token: adminToken, body: { assignedTo: deliveryUserId },
  });
  assert.equal(assign.status, 200);
  assert.equal(assign.data.assigned_to, deliveryUserId);
  assert.equal(assign.data.status, 'ASSIGNED');

  const dispatch = await req(ctx.baseUrl, 'PATCH', `/deliveries/${delivery.id}/dispatch`, { token: deliveryToken, body: {} });
  assert.equal(dispatch.status, 200);
  assert.equal(dispatch.data.status, 'DISPATCHED');

  const inTransit = await req(ctx.baseUrl, 'PATCH', `/deliveries/${delivery.id}/in-transit`, { token: deliveryToken, body: {} });
  assert.equal(inTransit.status, 200);
  assert.equal(inTransit.data.status, 'IN_TRANSIT');

  const form = new FormData();
  // Real JPEG magic-byte signature (FF D8 FF) — the upload middleware now verifies file
  // content against its signature (Finding 007), so arbitrary fake bytes no longer pass.
  const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('filler-image-data')]);
  form.append('photo', new Blob([jpegBytes], { type: 'image/jpeg' }), 'pod.jpg');
  const pod = await req(ctx.baseUrl, 'PATCH', `/deliveries/${delivery.id}/pod`, { token: deliveryToken, form });
  assert.equal(pod.status, 200);
  assert.equal(pod.data.status, 'DELIVERED');
  assert.equal(pod.data.buyer_confirmed_at, null, 'POD upload alone must not fake buyer confirmation');

  const confirm = await req(ctx.baseUrl, 'PATCH', `/orders/${delivery.order_id}/confirm-receipt`, { token: buyerToken, body: {} });
  assert.equal(confirm.status, 200);

  const afterConfirm = await req(ctx.baseUrl, 'GET', `/deliveries/${delivery.id}`, { token: adminToken });
  assert.ok(afterConfirm.data.buyer_confirmed_at, 'buyer_confirmed_at should be set only once the buyer actually confirms receipt');
});
