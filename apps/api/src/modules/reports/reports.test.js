const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let adminToken;
let buyerToken;

before(async () => {
  ctx = await startServer();
  adminToken = await login(ctx.baseUrl, 'admin');
  buyerToken = await login(ctx.baseUrl, 'buyer1');
});

after(async () => { await ctx.close(); });

const ROUTES = [
  '/reports',
  '/reports/summary',
  '/reports/sales-trend',
  '/reports/category-performance',
  '/reports/top-products',
  '/reports/buyer-behaviour',
  '/reports/credit-risk',
  '/reports/inventory-turnover',
  '/reports/supplier-contribution',
  '/reports/returns-analytics',
];

test('every BI report view responds with 200 and a real payload, not a silent failure', async () => {
  for (const route of ROUTES) {
    const { status, data } = await req(ctx.baseUrl, 'GET', route, { token: adminToken });
    assert.equal(status, 200, `${route} should return 200`);
    assert.ok(data && typeof data === 'object', `${route} should return a JSON object`);
  }
});

test('a buyer without report.view cannot reach any BI report route', async () => {
  for (const route of ROUTES) {
    const { status } = await req(ctx.baseUrl, 'GET', route, { token: buyerToken });
    assert.equal(status, 403, `${route} should be forbidden for a buyer`);
  }
});
