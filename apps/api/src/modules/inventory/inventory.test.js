const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let inventoryToken;

before(async () => {
  ctx = await startServer();
  inventoryToken = await login(ctx.baseUrl, 'inventory');
});

after(async () => { await ctx.close(); });

test('regression (BUG-003): GET /inventory/movements returns real rows instead of a 500 (wrong column name)', async () => {
  const { status, data } = await req(ctx.baseUrl, 'GET', '/inventory/movements?limit=5', { token: inventoryToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.data), 'movements response should be a real array');
});

test('movements endpoint also works with from/to date filters applied', async () => {
  const { status } = await req(ctx.baseUrl, 'GET', '/inventory/movements?limit=5&from=2020-01-01&to=2030-01-01', { token: inventoryToken });
  assert.equal(status, 200);
});

test('inventory summary and product list respond correctly', async () => {
  const summary = await req(ctx.baseUrl, 'GET', '/inventory/summary', { token: inventoryToken });
  assert.equal(summary.status, 200);
  assert.ok(typeof summary.data.data.total_products !== 'undefined');

  const products = await req(ctx.baseUrl, 'GET', '/inventory/products?limit=5', { token: inventoryToken });
  assert.equal(products.status, 200);
  assert.ok(Array.isArray(products.data.data));
});

test('a role without stock.view (finance) cannot reach inventory routes', async () => {
  // Buyers and delivery coordinators are intentionally granted stock.view (they need to see
  // availability), so this isn't a role that can exercise a 403 here — finance is.
  const financeToken = await login(ctx.baseUrl, 'finance');
  const { status } = await req(ctx.baseUrl, 'GET', '/inventory/movements', { token: financeToken });
  assert.equal(status, 403);
});
