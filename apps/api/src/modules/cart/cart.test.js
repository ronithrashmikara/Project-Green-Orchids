const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let token;
let product; // a real, ACTIVE product with moq > 1, discovered from the buyer catalogue

before(async () => {
  ctx = await startServer();
  token = await login(ctx.baseUrl, 'buyer1');
  await req(ctx.baseUrl, 'DELETE', '/cart', { token });

  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token });
  product = data.products.find((p) => p.moq > 1 && p.status === 'ACTIVE');
  assert.ok(product, 'seed data should include at least one ACTIVE product with moq > 1');
});

after(async () => {
  await req(ctx.baseUrl, 'DELETE', '/cart', { token });
  await ctx.close();
});

test('adding a below-MOQ quantity is rejected at add-time, not silently accepted (regression: BUG-007)', async () => {
  const { status, data } = await req(ctx.baseUrl, 'POST', '/cart/items', {
    token, body: { product_id: product.id, quantity: product.moq - 1 },
  });
  assert.equal(status, 400);
  assert.equal(data.error.code, 'BELOW_MOQ');
});

test('adding exactly the MOQ succeeds and shows up in the cart', async () => {
  const { status } = await req(ctx.baseUrl, 'POST', '/cart/items', {
    token, body: { product_id: product.id, quantity: product.moq },
  });
  assert.equal(status, 201);

  const { data: cart } = await req(ctx.baseUrl, 'GET', '/cart', { token });
  const line = cart.items.find((i) => i.productId === product.id);
  assert.ok(line);
  assert.equal(line.quantity, product.moq);
});

test('updating an existing line down to below-MOQ is also rejected, but down to 0 (remove) is allowed', async () => {
  const belowMoq = await req(ctx.baseUrl, 'PUT', `/cart/items/${product.id}`, {
    token, body: { quantity: Math.max(1, product.moq - 1) },
  });
  assert.equal(belowMoq.status, 400);
  assert.equal(belowMoq.data.error.code, 'BELOW_MOQ');

  const remove = await req(ctx.baseUrl, 'PUT', `/cart/items/${product.id}`, { token, body: { quantity: 0 } });
  assert.equal(remove.status, 200);
});

test('adding more than available stock is rejected with INSUFFICIENT_STOCK', async () => {
  const { status, data } = await req(ctx.baseUrl, 'POST', '/cart/items', {
    token, body: { product_id: product.id, quantity: product.stock + 1_000_000 },
  });
  assert.equal(status, 400);
  assert.equal(data.error.code, 'INSUFFICIENT_STOCK');
});
