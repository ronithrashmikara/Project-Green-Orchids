const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let buyerToken;
let adminToken;
let deliveryToken;
let deliveryUserId;
let delivery;

before(async () => {
  ctx = await startServer();
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  adminToken = await login(ctx.baseUrl, 'admin');
  deliveryToken = await login(ctx.baseUrl, 'delivery');

  const me = await req(ctx.baseUrl, 'GET', '/auth/me', { token: deliveryToken });
  deliveryUserId = me.data.data.id;

  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  const product = data.products.find((p) => p.status === 'ACTIVE');
  await req(ctx.baseUrl, 'DELETE', '/cart', { token: buyerToken });
  await req(ctx.baseUrl, 'POST', '/cart/items', { token: buyerToken, body: { product_id: product.id, quantity: product.moq } });
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
  form.append('photo', new Blob([Buffer.from('fake-jpeg-bytes')], { type: 'image/jpeg' }), 'pod.jpg');
  const pod = await req(ctx.baseUrl, 'PATCH', `/deliveries/${delivery.id}/pod`, { token: deliveryToken, form });
  assert.equal(pod.status, 200);
  assert.equal(pod.data.status, 'DELIVERED');
  assert.equal(pod.data.buyer_confirmed_at, null, 'POD upload alone must not fake buyer confirmation');

  const confirm = await req(ctx.baseUrl, 'PATCH', `/orders/${delivery.order_id}/confirm-receipt`, { token: buyerToken, body: {} });
  assert.equal(confirm.status, 200);

  const afterConfirm = await req(ctx.baseUrl, 'GET', `/deliveries/${delivery.id}`, { token: adminToken });
  assert.ok(afterConfirm.data.buyer_confirmed_at, 'buyer_confirmed_at should be set only once the buyer actually confirms receipt');
});
