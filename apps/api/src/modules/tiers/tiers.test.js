const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;
let tierId;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');
});

after(async () => {
  if (tierId) await req(ctx.baseUrl, 'DELETE', `/admin/tiers/${tierId}`, { token: adminToken }).catch(() => {});
  await ctx.close();
});

test('admin can create, list, and update a buyer tier', async () => {
  const created = await req(ctx.baseUrl, 'POST', '/admin/tiers', {
    token: adminToken,
    body: { name: `AUTOTEST_${Date.now()}`.slice(0, 50), discount: 5, creditLimit: 100000, paymentTerms: 'NET_30', minOrders: 0 },
  });
  assert.equal(created.status, 201);
  tierId = created.data.data.id;

  const list = await req(ctx.baseUrl, 'GET', '/admin/tiers', { token: adminToken });
  assert.equal(list.status, 200);
  assert.ok(list.data.data.some((t) => t.id === tierId));

  const updated = await req(ctx.baseUrl, 'PATCH', `/admin/tiers/${tierId}`, { token: adminToken, body: { discount: 8 } });
  assert.equal(updated.status, 200);
});

test('a plain buyer cannot manage tiers', async () => {
  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const { status } = await req(ctx.baseUrl, 'GET', '/admin/tiers', { token: buyerToken });
  assert.equal(status, 403);
});
