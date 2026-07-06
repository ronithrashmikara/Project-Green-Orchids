const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, req, login } = require('../../test/helpers');

let ctx;
let buyerToken;
let adminToken;
let product;

before(async () => {
  ctx = await startServer();
  buyerToken = await login(ctx.baseUrl, 'buyer1');
  adminToken = await login(ctx.baseUrl, 'admin');
  const { data } = await req(ctx.baseUrl, 'GET', '/products/buyer?limit=50', { token: buyerToken });
  product = data.products.find((p) => p.status === 'ACTIVE');
});

after(async () => { await ctx.close(); });

async function acceptedRfq() {
  const created = await req(ctx.baseUrl, 'POST', '/rfqs', {
    token: buyerToken, body: { items: [{ product_id: product.id, quantity: product.moq + 5 }], notes: 'automated test rfq' },
  });
  assert.equal(created.status, 201);
  const rfq = created.data.data;

  await req(ctx.baseUrl, 'PATCH', `/rfqs/${rfq.id}/review`, { token: adminToken, body: {} });

  const detail = await req(ctx.baseUrl, 'GET', `/rfqs/${rfq.id}`, { token: adminToken });
  const line = detail.data.data.lines[0];

  await req(ctx.baseUrl, 'PATCH', `/rfqs/${rfq.id}/quote`, {
    token: adminToken, body: { items: [{ rfq_item_id: line.id, quoted_price: Number(product.price) }] },
  });
  await req(ctx.baseUrl, 'PATCH', `/rfqs/${rfq.id}/accept`, { token: buyerToken, body: {} });
  return rfq.id;
}

test('golden path: RFQ create -> admin review -> quote -> buyer accept -> convert to a real order', async () => {
  const rfqId = await acceptedRfq();

  const convert = await req(ctx.baseUrl, 'POST', '/orders/from-rfq', { token: buyerToken, body: { rfq_id: rfqId } });
  assert.equal(convert.status, 201);
  assert.equal(convert.data.data.source, 'RFQ_CONVERSION');
  assert.equal(convert.data.data.rfq_id, rfqId);

  const afterConvert = await req(ctx.baseUrl, 'GET', `/rfqs/${rfqId}`, { token: adminToken });
  assert.equal(afterConvert.data.data.status, 'CONVERTED');
});

test('regression (BUG-005): the old dead /rfqs/:id/convert stub is gone, not silently reintroduced', async () => {
  // Was a scaffold that returned a fake 200 without creating an order or advancing status —
  // deleted rather than fixed, since POST /orders/from-rfq is the one real implementation the
  // buyer UI actually calls. This just guards against it quietly coming back.
  const rfqId = await acceptedRfq();
  const convert = await req(ctx.baseUrl, 'POST', `/rfqs/${rfqId}/convert`, { token: buyerToken, body: {} });
  assert.equal(convert.status, 404);
});

test('cannot skip straight from SUBMITTED to QUOTED without going through UNDER_REVIEW', async () => {
  const created = await req(ctx.baseUrl, 'POST', '/rfqs', {
    token: buyerToken, body: { items: [{ product_id: product.id, quantity: product.moq }], notes: 'state machine test' },
  });
  const rfq = created.data.data;
  const detail = await req(ctx.baseUrl, 'GET', `/rfqs/${rfq.id}`, { token: adminToken });
  const line = detail.data.data.lines[0];

  const { status, data } = await req(ctx.baseUrl, 'PATCH', `/rfqs/${rfq.id}/quote`, {
    token: adminToken, body: { items: [{ rfq_item_id: line.id, quoted_price: Number(product.price) }] },
  });
  assert.equal(status, 409);
  assert.equal(data.error.code, 'INVALID_TRANSITION');
});

test('regression (FINDING-S01): concurrent RFQ-to-order conversion only creates one order', async () => {
  const rfqId = await acceptedRfq();

  // Before locking the RFQ row inside the transaction, this was a real race: with enough
  // concurrent requests (10-way), 3-6 duplicate orders were created from a single accepted
  // RFQ because every request re-read status='ACCEPTED' before any of them had committed
  // their CONVERTED status write.
  const results = await Promise.all(
    Array.from({ length: 10 }, () => req(ctx.baseUrl, 'POST', '/orders/from-rfq', { token: buyerToken, body: { rfq_id: rfqId } }))
  );
  const successes = results.filter((r) => r.status === 201);
  assert.equal(successes.length, 1, 'exactly one conversion should succeed out of 10 concurrent attempts');
  const failures = results.filter((r) => r.status !== 201);
  for (const f of failures) {
    assert.equal(f.status, 409);
    assert.equal(f.data.error.code, 'INVALID_STATE');
  }

  const orders = await req(ctx.baseUrl, 'GET', '/orders?limit=100', { token: adminToken });
  const matching = (orders.data.data || []).filter((o) => o.rfq_id === rfqId);
  assert.equal(matching.length, 1, 'exactly one order should exist for this RFQ');
});
