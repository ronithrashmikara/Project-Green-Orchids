const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');
});

after(async () => { await ctx.close(); });

test('admin can create a supplier, list it, update it, and see its linked products', async () => {
  const created = await req(ctx.baseUrl, 'POST', '/suppliers', {
    token: adminToken,
    body: { name: `Automated Test Supplier ${Date.now()}`, contact_person: 'Test Person', phone: '+94-77-000-0000', email: `supplier-${Date.now()}@example.invalid` },
  });
  assert.equal(created.status, 201);
  const supplier = created.data.data;

  const list = await req(ctx.baseUrl, 'GET', '/suppliers?limit=100', { token: adminToken });
  assert.ok(list.data.data.some((s) => s.id === supplier.id));

  const updated = await req(ctx.baseUrl, 'PATCH', `/suppliers/${supplier.id}`, { token: adminToken, body: { contact_person: 'Updated Person' } });
  assert.equal(updated.status, 200);

  const products = await req(ctx.baseUrl, 'GET', `/suppliers/${supplier.id}/products`, { token: adminToken });
  assert.equal(products.status, 200);
});

test('a plain buyer cannot manage suppliers', async () => {
  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const { status } = await req(ctx.baseUrl, 'GET', '/suppliers', { token: buyerToken });
  assert.equal(status, 403);
});
