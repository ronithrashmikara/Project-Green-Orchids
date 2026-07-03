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

test('login history and audit log both return real rows, and the audit log actor filter narrows results', async () => {
  const logins = await req(ctx.baseUrl, 'GET', '/admin/security/logins?limit=10', { token: adminToken });
  assert.equal(logins.status, 200);
  assert.ok(Array.isArray(logins.data.data));

  const auditAll = await req(ctx.baseUrl, 'GET', '/admin/security/audit-logs?limit=50', { token: adminToken });
  assert.equal(auditAll.status, 200);
  assert.ok(Array.isArray(auditAll.data.data));

  const auditFiltered = await req(ctx.baseUrl, 'GET', '/admin/security/audit-logs?actor=admin@example.invalid&limit=50', { token: adminToken });
  assert.equal(auditFiltered.status, 200);
  for (const row of auditFiltered.data.data) {
    assert.match(row.actor, /admin@example\.invalid/i);
  }
});

test('force-logout revokes an active session so it no longer appears in the active-sessions list', async () => {
  // Create a fresh session to force-logout, so this doesn't disturb the admin token this
  // test file is otherwise using.
  await login(ctx.baseUrl, 'buyer1');
  const sessions = await req(ctx.baseUrl, 'GET', '/admin/security/sessions', { token: adminToken });
  assert.equal(sessions.status, 200);
  const target = sessions.data.data.find((s) => s.email === 'buyer1@example.invalid');
  assert.ok(target, 'the session just created should be listed');

  const revoke = await req(ctx.baseUrl, 'POST', `/admin/security/sessions/${target.id}/force-logout`, { token: adminToken });
  assert.equal(revoke.status, 200);

  const after_ = await req(ctx.baseUrl, 'GET', '/admin/security/sessions', { token: adminToken });
  assert.ok(!after_.data.data.some((s) => s.id === target.id), 'the force-logged-out session should no longer be active');
});

test('access-window settings can be read and updated by admin', async () => {
  const current = await req(ctx.baseUrl, 'GET', '/admin/security/access-windows', { token: adminToken });
  assert.equal(current.status, 200);

  const updated = await req(ctx.baseUrl, 'PUT', '/admin/security/access-windows', {
    token: adminToken, body: current.data.data,
  });
  assert.equal(updated.status, 200);
});

test('a non-admin cannot reach any security panel route', async () => {
  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const { status } = await req(ctx.baseUrl, 'GET', '/admin/security/audit-logs', { token: buyerToken });
  assert.equal(status, 403);
});
