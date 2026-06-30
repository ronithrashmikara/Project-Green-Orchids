const express = require('express');
const { query, tx } = require('../../config/db');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');

const router = express.Router();
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const positiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

function productDto(row, discountRate = 0, includePricing = false) {
  const basePrice = Number(row.base_price || 0);
  const discount = Number(discountRate || 0);
  const dto = {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category_name,
    categoryId: row.category_id,
    type: row.product_type,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    stock: row.stock_qty,
    reserved: row.reserved_qty,
    available: Math.max(0, Number(row.stock_qty || 0) - Number(row.reserved_qty || 0)),
    moq: row.moq,
    unit: row.unit_size,
    status: row.status,
    imageUrl: row.image_url,
  };

  if (includePricing) {
    dto.basePrice = basePrice;
    dto.price = basePrice;
    dto.tierPrice = Number((basePrice * (1 - discount / 100)).toFixed(2));
    dto.discount = discount;
  }

  return dto;
}

async function listProducts(req, res, buyerMode) {
  const page = positiveInt(req.query.page, 1, 100000);
  const limit = positiveInt(req.query.limit, buyerMode ? 20 : 60, 100);
  const offset = (page - 1) * limit;
  const values = [];
  const where = [`p.status = 'ACTIVE'`];
  const add = (sql, value) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)); };

  if (req.query.type) add('p.product_type = ?', req.query.type);
  if (req.query.category) add('c.name = ?', req.query.category);
  if (req.query.supplier) add('p.supplier_id = ?', Number(req.query.supplier));
  if (req.query.search) add('(p.name ILIKE ? OR p.sku ILIKE ? OR p.description ILIKE ?)', `%${req.query.search}%`);

  // The search predicate contains the same placeholder three times.
  if (req.query.search) {
    const last = values.length;
    where[where.length - 1] = `(p.name ILIKE $${last} OR p.sku ILIKE $${last} OR COALESCE(p.description,'') ILIKE $${last})`;
  }
  if (req.query.availability === 'IN_STOCK') where.push('(p.stock_qty - p.reserved_qty) > 0');
  if (req.query.availability === 'LOW') where.push('(p.stock_qty - p.reserved_qty) BETWEEN 1 AND p.reorder_level');
  if (req.query.availability === 'OUT') where.push('(p.stock_qty - p.reserved_qty) <= 0');

  const sortMap = {
    price_asc: 'p.base_price ASC', price_desc: 'p.base_price DESC',
    name_asc: 'p.name ASC', name_desc: 'p.name DESC',
  };
  const orderBy = sortMap[req.query.sort] || 'p.created_at DESC';

  let discountRate = 0;
  if (buyerMode && req.user) {
    const tier = await query(
      `SELECT COALESCE(bt.discount_rate,0) AS discount_rate
       FROM trade_accounts ta LEFT JOIN buyer_tiers bt ON bt.id=ta.tier_id
       WHERE ta.user_id=$1`, [req.user.id]
    );
    discountRate = tier.rows[0]?.discount_rate || 0;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE ${where.join(' AND ')}`,
    values
  );
  values.push(limit, offset);
  const result = await query(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name,
            (SELECT pi.url FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.is_primary DESC, pi.sort_order, pi.id LIMIT 1) AS image_url
     FROM products p
     LEFT JOIN categories c ON c.id=p.category_id
     LEFT JOIN suppliers s ON s.id=p.supplier_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy} LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  const total = countResult.rows[0].total;
  res.json({
    products: result.rows.map(row => productDto(row, discountRate, buyerMode)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

router.get('/products/catalogue', asyncRoute((req, res) => listProducts(req, res, false)));
router.get('/products/buyer', requireAuth, asyncRoute((req, res) => listProducts(req, res, true)));

router.get('/products/types-and-categories', asyncRoute(async (_req, res) => {
  const [types, categories, suppliers] = await Promise.all([
    query(`SELECT DISTINCT product_type FROM products WHERE status='ACTIVE' ORDER BY product_type`),
    query(`SELECT DISTINCT c.name FROM categories c JOIN products p ON p.category_id=c.id WHERE p.status='ACTIVE' ORDER BY c.name`),
    query(`SELECT DISTINCT s.id,s.name FROM suppliers s JOIN products p ON p.supplier_id=s.id WHERE p.status='ACTIVE' AND s.status='ACTIVE' ORDER BY s.name`),
  ]);
  res.json({
    types: types.rows.map(r => r.product_type),
    categories: categories.rows.map(r => r.name),
    suppliers: suppliers.rows,
  });
}));

router.get('/me/summary', requireAuth, asyncRoute(async (req, res) => {
  const accountResult = await query(
    `SELECT ta.id,ta.credit_limit,ta.payment_term,bt.name AS tier,bt.discount_rate
     FROM trade_accounts ta LEFT JOIN buyer_tiers bt ON bt.id=ta.tier_id WHERE ta.user_id=$1`,
    [req.user.id]
  );
  if (!accountResult.rows.length) return res.status(404).json({ message: 'Trade account not found' });
  const account = accountResult.rows[0];
  const [orders, invoices, rfqs, activity] = await Promise.all([
    query(`SELECT COUNT(*)::int AS count FROM orders WHERE buyer_id=$1 AND status NOT IN ('DELIVERED','CANCELLED','REJECTED')`, [account.id]),
    query(`SELECT COUNT(*)::int AS count,COALESCE(SUM(balance_due),0)::numeric AS total FROM invoices WHERE buyer_id=$1 AND balance_due>0`, [account.id]),
    query(`SELECT COUNT(*)::int AS count FROM rfqs WHERE buyer_id=$1 AND status IN ('DRAFT','SUBMITTED','QUOTED')`, [account.id]),
    query(`SELECT description,created_at,"details" FROM (
             SELECT 'Order '||order_no AS description,created_at,status AS "details" FROM orders WHERE buyer_id=$1
             UNION ALL
             SELECT 'RFQ '||rfq_no AS description,created_at,status AS "details" FROM rfqs WHERE buyer_id=$1
           ) a ORDER BY created_at DESC LIMIT 6`, [account.id]),
  ]);
  const creditLimit = Number(account.credit_limit || 0);
  const creditUsed = Number(invoices.rows[0].total || 0);
  res.json({
    tier: account.tier,
    discount: Number(account.discount_rate || 0),
    paymentTerms: account.payment_term,
    creditLimit,
    creditUsed,
    creditAvailable: Math.max(0, creditLimit - creditUsed),
    openOrders: orders.rows[0].count,
    unpaidCount: invoices.rows[0].count,
    unpaidTotal: creditUsed,
    activeRfqs: rfqs.rows[0].count,
    recentActivity: activity.rows.map(r => ({ description:r.description, createdAt:r.created_at, details:r.details })),
  });
}));

async function buyerAccount(userId, executor = query) {
  const result = await executor(
    `SELECT ta.id,COALESCE(bt.discount_rate,0) AS discount_rate
     FROM trade_accounts ta LEFT JOIN buyer_tiers bt ON bt.id=ta.tier_id
     WHERE ta.user_id=$1`, [userId]
  );
  return result.rows[0];
}

router.get('/cart', requireAuth, asyncRoute(async (req, res) => {
  const account = await buyerAccount(req.user.id);
  if (!account) return res.json({ items: [] });
  const result = await query(
    `SELECT ci.product_id,ci.qty,p.name,p.base_price,p.stock_qty,p.moq,c.name AS category,
            (SELECT pi.url FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.is_primary DESC,pi.sort_order,pi.id LIMIT 1) AS image_url
     FROM carts ca JOIN cart_items ci ON ci.cart_id=ca.id
     JOIN products p ON p.id=ci.product_id LEFT JOIN categories c ON c.id=p.category_id
     WHERE ca.buyer_id=$1 ORDER BY ci.created_at`, [account.id]
  );
  const discount = Number(account.discount_rate || 0);
  res.json({ items: result.rows.map(r => ({
    productId:r.product_id, name:r.name, price:Number(r.base_price),
    tierPrice:Number((Number(r.base_price)*(1-discount/100)).toFixed(2)),
    quantity:r.qty, imageUrl:r.image_url, category:r.category, stock:r.stock_qty, moq:r.moq,
  })) });
}));

router.put('/cart', requireAuth, asyncRoute(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const saved = await tx(async client => {
    const account = await buyerAccount(req.user.id, client.query.bind(client));
    if (!account) throw Object.assign(new Error('Trade account not found'), { status:404 });
    let cart = await client.query('SELECT id FROM carts WHERE buyer_id=$1 FOR UPDATE', [account.id]);
    if (!cart.rows.length) cart = await client.query('INSERT INTO carts (buyer_id) VALUES ($1) RETURNING id', [account.id]);
    const cartId = cart.rows[0].id;
    await client.query('DELETE FROM cart_items WHERE cart_id=$1', [cartId]);
    for (const item of items) {
      const productId = Number(item.productId);
      const qty = positiveInt(item.quantity, 1, 100000);
      if (Number.isInteger(productId) && productId > 0) {
        await client.query('INSERT INTO cart_items (cart_id,product_id,qty) VALUES ($1,$2,$3)', [cartId,productId,qty]);
      }
    }
    return { count:items.length };
  });
  res.json({ success:true, ...saved });
}));

router.get('/inventory/dashboard', requireAuth, requireRole('ADMIN', 'INVENTORY_MANAGER'), asyncRoute(async (_req, res) => {
  const [stock, alerts] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total_products,
                  COALESCE(SUM(stock_qty*base_price),0)::numeric AS stock_value,
                  COUNT(*) FILTER (WHERE stock_qty>0 AND stock_qty<=reorder_level)::int AS low_stock,
                  COUNT(*) FILTER (WHERE stock_qty<=0)::int AS out_of_stock
           FROM products WHERE status='ACTIVE'`),
    query(`SELECT
             COUNT(*) FILTER (WHERE alert_type='LOW_STOCK' AND status='OPEN')::int AS low,
             COUNT(*) FILTER (WHERE alert_type='FAST_MOVING' AND status='OPEN')::int AS fast,
             COUNT(*) FILTER (WHERE alert_type='DEAD_STOCK' AND status='OPEN')::int AS dead
           FROM stock_alerts`),
  ]);
  const s = stock.rows[0], a = alerts.rows[0];
  res.json({
    totalProducts:s.total_products,
    totalStockValue:Number(s.stock_value),
    lowStockCount:s.low_stock,
    outOfStockCount:s.out_of_stock,
    lowStockAlerts:a.low,
    fastMovingAlerts:a.fast,
    deadStockAlerts:a.dead,
  });
}));

module.exports = router;
