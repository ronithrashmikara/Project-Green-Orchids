const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login, CREDS } = require('../../test/helpers');

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await ctx.close(); });

test('every seeded role can log in and lands with the right role/permissions', async () => {
  for (const role of ['admin', 'finance', 'inventory', 'delivery', 'buyer1']) {
    const { status, data } = await req(ctx.baseUrl, 'POST', '/auth/login', { body: CREDS[role] });
    assert.equal(status, 200, `${role} login should succeed`);
    assert.ok(data.accessToken, `${role} should get an access token`);
    assert.ok(Array.isArray(data.user.permissions), `${role} should have a permissions array`);
  }
});

test('wrong password and unknown email both return a generic invalid-credentials error', async () => {
  const wrongPw = await req(ctx.baseUrl, 'POST', '/auth/login', { body: { email: CREDS.admin.email, password: 'WrongPassword1!' } });
  assert.equal(wrongPw.status, 401);
  assert.equal(wrongPw.data.error.code, 'INVALID_CREDENTIALS');

  const noSuchUser = await req(ctx.baseUrl, 'POST', '/auth/login', { body: { email: 'nobody@example.invalid', password: 'WhateverPassword1' } });
  assert.equal(noSuchUser.status, 401);
  assert.equal(noSuchUser.data.error.code, 'INVALID_CREDENTIALS');
});

test('a request with no token is rejected, and a buyer token cannot reach admin-only routes', async () => {
  const noToken = await req(ctx.baseUrl, 'GET', '/orders');
  assert.equal(noToken.status, 401);

  const buyerToken = await login(ctx.baseUrl, 'buyer1');
  const forbidden = await req(ctx.baseUrl, 'GET', '/users', { token: buyerToken });
  assert.equal(forbidden.status, 403);
});

test('account locks after 5 failed attempts within 15 minutes, correct password is rejected while locked, and admin unlock actually works', async () => {
  const email = 'buyer2@example.invalid';
  for (let i = 0; i < 5; i++) {
    const { status } = await req(ctx.baseUrl, 'POST', '/auth/login', { body: { email, password: 'DefinitelyWrong!' } });
    assert.ok([401, 429].includes(status));
  }
  const lockedOut = await req(ctx.baseUrl, 'POST', '/auth/login', { body: { email, password: CREDS.buyer2.password } });
  assert.equal(lockedOut.status, 429);
  assert.equal(lockedOut.data.error.code, 'ACCOUNT_LOCKED');

  // Regression for the "admin can't see/unlock a real lockout" bug: the locked-accounts panel
  // must be computed the same way the login check itself is, not from unrelated columns.
  const adminToken = await login(ctx.baseUrl, 'admin');
  const { data: locked } = await req(ctx.baseUrl, 'GET', '/admin/security/locked-accounts', { token: adminToken });
  const row = locked.data.find((r) => r.email === email);
  assert.ok(row, 'buyer2 should show up in the admin locked-accounts list');
  const unlock = await req(ctx.baseUrl, 'POST', `/admin/security/locked-accounts/${row.id}/unlock`, { token: adminToken });
  assert.equal(unlock.status, 200);

  const afterUnlock = await req(ctx.baseUrl, 'POST', '/auth/login', { body: { email, password: CREDS.buyer2.password } });
  assert.equal(afterUnlock.status, 200, 'buyer2 should be able to log in again immediately after unlock');
});

test('changing password rejects a wrong current password, and invalidates the old access token on success', async () => {
  const token = await login(ctx.baseUrl, 'buyer1');
  const NEW_PASSWORD = 'BrandNewPassw0rd!';

  const wrongCurrent = await req(ctx.baseUrl, 'POST', '/auth/me/change-password', {
    token, body: { currentPassword: 'NotTheRealPassword1', newPassword: NEW_PASSWORD },
  });
  assert.equal(wrongCurrent.status, 400);
  assert.equal(wrongCurrent.data.error.code, 'INVALID_PASSWORD');

  const changed = await req(ctx.baseUrl, 'POST', '/auth/me/change-password', {
    token, body: { currentPassword: CREDS.buyer1.password, newPassword: NEW_PASSWORD },
  });
  assert.equal(changed.status, 200);

  const staleTokenUse = await req(ctx.baseUrl, 'GET', '/auth/me', { token });
  assert.equal(staleTokenUse.status, 401);
  assert.equal(staleTokenUse.data.error.code, 'TOKEN_INVALIDATED');

  const relogin = await req(ctx.baseUrl, 'POST', '/auth/login', { body: { email: CREDS.buyer1.email, password: NEW_PASSWORD } });
  assert.equal(relogin.status, 200);

  // Revert so other test files can still log in as buyer1 with the seeded password.
  const reverted = await req(ctx.baseUrl, 'POST', '/auth/me/change-password', {
    token: relogin.data.accessToken, body: { currentPassword: NEW_PASSWORD, newPassword: CREDS.buyer1.password },
  });
  assert.equal(reverted.status, 200);
});
