const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;
let createdUserId;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');
});

after(async () => { await ctx.close(); });

test('regression: admin can create a new staff user with the real numeric role_id (roles.id is a smallint, not a UUID)', async () => {
  const email = `automated-staff-${Date.now()}@example.invalid`;
  const { status, data } = await req(ctx.baseUrl, 'POST', '/users', {
    token: adminToken, body: { email, name: 'Automated Test Staff', role_id: 3 },
  });
  assert.equal(status, 201, `expected creation to succeed, got: ${JSON.stringify(data)}`);
  assert.equal(data.data.email, email);
  assert.equal(data.data.role_id, 3);
  createdUserId = data.data.id;
});

test('admin can list users and drill into one user\'s login history', async () => {
  const list = await req(ctx.baseUrl, 'GET', '/users?limit=10', { token: adminToken });
  assert.equal(list.status, 200);
  assert.ok(list.data.data.length > 0);

  const history = await req(ctx.baseUrl, 'GET', `/users/${createdUserId}/login-history`, { token: adminToken });
  assert.equal(history.status, 200);
});

test('admin can update a user\'s role with the same numeric role_id convention', async () => {
  const { status, data } = await req(ctx.baseUrl, 'PATCH', `/users/${createdUserId}`, { token: adminToken, body: { role_id: 4 } });
  assert.equal(status, 200);
  assert.equal(data.data.role_id, 4);
});

test('a plain buyer cannot manage users', async () => {
  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const { status } = await req(ctx.baseUrl, 'GET', '/users', { token: buyerToken });
  assert.equal(status, 403);
});
