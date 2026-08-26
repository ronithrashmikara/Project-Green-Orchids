const crypto = require('crypto');
const { tx } = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const repo = require('./products.repository');
const { paginate } = require('../../utils/pagination');
const { enqueueEmail } = require('../../utils/outbox');
const { stringify } = require('csv-stringify/sync');

const BULK_ACTION_STATUS = { hide: 'INACTIVE', show: 'ACTIVE' };

// Auto-SKU generation (Audit F1 / owner-reported): operators should not have to
// invent SKUs. Format `<TYPE>-<6 base36 chars>` — readable, type-identifiable,
// collision-safe (regenerated up to 5 times on the astronomically unlikely dup).
const SKU_PREFIX = { ORCHID: 'ORC', FERTILIZER: 'FRT', SUPPLY: 'SUP', OTHER: 'GEN' };
function generateSku(productType) {
  const prefix = SKU_PREFIX[productType] || SKU_PREFIX.OTHER;
  const rand = crypto.randomBytes(4).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return `${prefix}-${rand.slice(0, 6).padEnd(6, '0')}`;
}

const service = {
  async bulkAction(ids, action, actor) {
    const status = BULK_ACTION_STATUS[action];
    if (!status) throw new AppError('INVALID_ACTION', `Unsupported bulk action: ${action}`, 400);
    const count = await repo.bulkUpdateStatus(ids, status);
    await writeAudit({ actor, action: 'PRODUCT_BULK_' + action.toUpperCase(), entity: 'products', entityId: ids.join(','), after: { ids, status } });
    return { updated: count };
  },

  async exportCsv(q) {
    const rows = await repo.findAllForExport({ status: q.status });
    return stringify(rows, { header: true });
  },

  async duplicate(id, actor) {
    const p = await repo.duplicate(id);
    if (!p) throw new AppError('NOT_FOUND', 'Product not found', 404);
    await writeAudit({ actor, action: 'PRODUCT_DUPLICATED', entity: 'products', entityId: p.id, after: { source_id: id, sku: p.sku } });
    return p;
  },

  async remove(id, actor) {
    const p = await repo.softRemove(id);
    if (!p) throw new AppError('NOT_FOUND', 'Product not found', 404);
    await writeAudit({ actor, action: 'PRODUCT_DISCONTINUED', entity: 'products', entityId: id });
  },


  async listCategories() {
    return repo.findCategories();
  },

  async list(q) {
    const o = paginate(q);
    const filters = { type: q.type, category: q.category, supplier_id: q.supplier_id, status: q.status, search: q.search, min_price: q.min_price, max_price: q.max_price };
    const { rows, total } = await repo.findAll(filters, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async get(id, userId) {
    const p = await repo.findById(id);
    if (!p) throw new AppError('NOT_FOUND', 'Product not found', 404);
    const images = await repo.findImages(id);
    const bulkTiers = await repo.findBulkTiers(id);

    let discount = 0;
    if (userId) {
      const tier = await repo.tierDiscountForUser(userId);
      discount = tier || 0;
    }
    const basePrice = Number(p.base_price || 0);

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      categoryId: p.category_id,
      supplierId: p.supplier_id,
      supplierName: p.supplier_name,
      type: p.product_type,
      unit: p.unit_size,
      stock: p.stock_qty,
      reserved: p.reserved_qty,
      available: Math.max(0, Number(p.stock_qty || 0) - Number(p.reserved_qty || 0)),
      moq: p.moq,
      status: p.status,
      basePrice,
      price: basePrice,
      discount,
      tierPrice: Number((basePrice * (1 - discount / 100)).toFixed(2)),
      images: images.map((im) => im.url),
      bulkTiers: bulkTiers.map((bt) => ({ minQty: bt.min_quantity, price: Number(bt.unit_price) })),
    };
  },

  async create(data, actor) {
    // Auto-generate the SKU when the operator left it blank (Audit F1). A
    // client-supplied SKU keeps its duplicate check; a generated one retries a
    // handful of times before surfacing a conflict.
    if (!data.sku) {
      for (let attempt = 0; attempt < 5; attempt++) {
        data.sku = generateSku(data.product_type);
        if (!(await repo.findBySku(data.sku))) break;
        if (attempt === 4) throw new AppError('SKU_GENERATION_FAILED', 'Could not generate a unique SKU, please try again', 409);
      }
    } else {
      const existing = await repo.findBySku(data.sku);
      if (existing) throw new AppError('DUPLICATE_SKU', 'A product with this SKU already exists', 409);
    }
    const p = await repo.create(data);
    await writeAudit({ actor, action: 'PRODUCT_CREATED', entity: 'products', entityId: p.id, after: { name: p.name, sku: p.sku, base_price: p.base_price } });
    return p;
  },

  async update(id, data, actor) {
    const before = await repo.findById(id);
    if (!before) throw new AppError('NOT_FOUND', 'Product not found', 404);
    // DISCONTINUED is blocked while stock is still reserved against open orders (Part C spec).
    if (data.status === 'DISCONTINUED' && Number(before.reserved_qty) > 0) {
      throw new AppError('RESERVED_STOCK', 'Cannot discontinue a product with reserved stock', 409);
    }
    const updated = await repo.update(id, data);
    await writeAudit({ actor, action: 'PRODUCT_UPDATED', entity: 'products', entityId: id, before: { name: before.name, status: before.status }, after: data });
    return updated;
  },

  async setBulkTiers(productId, tiers, actor) {
    const p = await repo.findById(productId);
    if (!p) throw new AppError('NOT_FOUND', 'Product not found', 404);
    const sorted = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min_quantity <= sorted[i - 1].min_quantity) {
        throw new AppError('INVALID_TIERS', 'Bulk tier quantities must be unique', 422);
      }
      if (Number(sorted[i].unit_price) >= Number(sorted[i - 1].unit_price)) {
        throw new AppError('INVALID_TIERS', 'Unit price must strictly decrease as quantity increases', 422);
      }
    }
    await repo.replaceBulkTiers(productId, sorted);
    await writeAudit({ actor, action: 'PRODUCT_BULK_TIERS_UPDATED', entity: 'products', entityId: productId, after: { tiers } });
    return repo.findBulkTiers(productId);
  },

  async uploadImage(productId, file, actor) {
    const p = await repo.findById(productId);
    if (!p) throw new AppError('NOT_FOUND', 'Product not found', 404);
    const image = await repo.addImage(productId, { url: file.url, alt_text: file.originalname, is_primary: false, sort_order: 0 });
    return image;
  },

  async updateImage(productId, imageId, data) {
    await this.get(productId);
    const img = await repo.findImageById(imageId);
    if (!img || img.product_id !== productId) throw new AppError('NOT_FOUND', 'Image not found', 404);
    if (data.is_primary) { await repo.clearPrimaryImages(productId); }
    await repo.updateImage(imageId, data);
    return repo.findImageById(imageId);
  },

  async removeImage(productId, imageId) {
    await this.get(productId);
    const img = await repo.findImageById(imageId);
    if (!img || img.product_id !== productId) throw new AppError('NOT_FOUND', 'Image not found', 404);
    await repo.removeImage(imageId);
  },

  async adjustStock(productId, data, actor) {
    const p = await repo.findById(productId);
    if (!p) throw new AppError('NOT_FOUND', 'Product not found', 404);

    // stock_movements.movement_type only accepts a fixed set of values (see 0005 migration) -
    // map the buyer-facing adjustment "type" onto that real enum.
    const MOVEMENT_TYPE = {
      RECEIVE: 'PURCHASE', RESTOCK: 'PURCHASE',
      DEDUCT: 'MANUAL_ADJUSTMENT', WRITE_OFF: 'DAMAGE_WRITE_OFF', RESERVATION_CONVERT: 'ORDER_FULFILL',
    };
    const movementType = MOVEMENT_TYPE[data.type];
    if (!movementType) throw new AppError('INVALID_TYPE', `Unsupported adjustment type: ${data.type}`, 400);

    await tx(async (client) => {
      // Lock the product row and read quantities inside the transaction so
      // concurrent adjustments serialize instead of losing updates (Audit F8).
      const locked = await client.query('SELECT stock_qty, reserved_qty FROM products WHERE id = $1 FOR UPDATE', [productId]);
      if (!locked.rows.length) throw new AppError('NOT_FOUND', 'Product not found', 404);
      let newQty = Number(locked.rows[0].stock_qty);
      switch (data.type) {
        case 'RECEIVE': case 'RESTOCK': newQty += data.quantity; break;
        case 'DEDUCT': case 'WRITE_OFF': case 'RESERVATION_CONVERT': newQty -= data.quantity; break;
      }
      if (newQty < 0) throw new AppError('INSUFFICIENT_STOCK', 'Stock cannot go below zero', 400);

      await repo.updateStock(client, productId, newQty);
      // RESERVATION_CONVERT converts a reservation into physical stock — consume
      // the reservation too, mirroring dispatchStock semantics (Audit F8).
      if (data.type === 'RESERVATION_CONVERT') {
        await client.query(
          'UPDATE products SET reserved_qty = GREATEST(reserved_qty - $1, 0), updated_at = NOW() WHERE id = $2',
          [data.quantity, productId],
        );
      }
      const note = `${data.type}: ${locked.rows[0].stock_qty} -> ${newQty}${data.note ? ` — ${data.note}` : ''}`;
      await repo.createStockMovement(client, {
        product_id: productId, movement_type: movementType, quantity: data.quantity, note,
        reference_type: data.reference_type || null, reference_id: data.reference_id || null, created_by: actor,
      });
    });
  },

  async getPriceHistory(productId, q) {
    await this.get(productId);
    const o = paginate(q);
    const { rows, total } = await repo.getPriceHistory(productId, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  // Price governance (B7 / Findings 1 & 14):
  //  - lock the product row (FOR UPDATE) before deciding
  //  - rolling 24h count from price_history (the immutable audit trail), not a phantom table
  //  - same price is a no-op (doesn't burn a change slot)
  //  - <2 prior changes -> apply + write price_history(source='MANUAL') atomically
  //  - 3rd change -> create a price_change_request(PENDING) for a different admin
  async changePrice(productId, data, actor) {
    const { tx, query } = require('../../config/db');
    const newPrice = Number(data.new_price);
    let result;
    await tx(async (client) => {
      const lock = await client.query('SELECT id, name, base_price FROM products WHERE id = $1 FOR UPDATE', [productId]);
      if (!lock.rows.length) throw new AppError('NOT_FOUND', 'Product not found', 404);
      const p = lock.rows[0];
      if (Number(p.base_price) === newPrice) throw new AppError('NO_OP_CHANGE', 'Price is unchanged', 400);

      // Rolling 24h window counted from the immutable price_history (re-counted under lock)
      const cnt = await client.query(
        `SELECT COUNT(*) AS c FROM price_history WHERE product_id = $1 AND changed_at > NOW() - INTERVAL '24 hours'`,
        [productId]
      );
      const recent = parseInt(cnt.rows[0].c, 10);

      if (recent < 2) {
        await client.query('UPDATE products SET base_price = $1, updated_at = NOW() WHERE id = $2', [newPrice, productId]);
        await client.query(
          `INSERT INTO price_history (product_id, old_price, new_price, changed_by, source)
           VALUES ($1,$2,$3,$4,'MANUAL')`,
          [productId, p.base_price, newPrice, actor]
        );
        await writeAudit({ actor, action: 'PRICE_CHANGED', entityType: 'products', entityId: String(productId),
          before: { base_price: p.base_price }, after: { base_price: newPrice } }, client);
        result = { applied: true, needs_approval: false, new_price: newPrice };
      } else {
        await client.query(
          `INSERT INTO price_change_requests (product_id, requested_by, current_price, requested_price, reason, status)
           VALUES ($1,$2,$3,$4,$5,'PENDING')`,
          [productId, actor, p.base_price, newPrice, data.reason]
        );
        // price_approval_needed is an admin broadcast, not a single-recipient
        // email — recipientEmail was hardcoded null, so this never had anyone
        // to reach. Resolve every admin and enqueue one outbox row each
        // (the outbox table has a single recipient_email column, not a list).
        const admins = await client.query(
          `SELECT u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'`
        );
        for (const admin of admins.rows) {
          await enqueueEmail(client, { recipientEmail: admin.email, template: 'price_approval_needed',
            payload: { productName: p.name, currentPrice: p.base_price, proposedPrice: newPrice, reason: data.reason } });
        }
        result = { applied: false, needs_approval: true };
      }
    });
    return result;
  },
};

module.exports = service;
