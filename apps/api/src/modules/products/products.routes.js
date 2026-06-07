const { Router } = require('express');
const c = require('./products.controller');
const { requireAuth, optionalAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { createSchema, updateSchema, stockAdjustmentSchema, priceChangeSchema } = require('./products.schema');
const r = Router();

// Public catalogue
r.get('/', optionalAuth, c.list);
r.get('/:id', optionalAuth, c.get);

// Protected mutations
r.post('/', requireAuth, requirePermission('ADMIN', 'INVENTORY_MANAGER'), validate({ body: createSchema }), c.create);
r.patch('/:id', requireAuth, requirePermission('ADMIN', 'INVENTORY_MANAGER'), validate({ body: updateSchema }), c.update);
r.post('/:id/images', requireAuth, requirePermission('ADMIN', 'INVENTORY_MANAGER'), c.uploadImage);
r.patch('/:id/images/:imageId', requireAuth, requirePermission('ADMIN', 'INVENTORY_MANAGER'), c.updateImage);
r.delete('/:id/images/:imageId', requireAuth, requirePermission('ADMIN', 'INVENTORY_MANAGER'), c.removeImage);
r.post('/:id/stock-adjustment', requireAuth, requirePermission('ADMIN', 'INVENTORY_MANAGER', 'WAREHOUSE_MANAGER'), validate({ body: stockAdjustmentSchema }), c.adjustStock);
r.get('/:id/price-history', requireAuth, c.priceHistory);
r.post('/:id/price-change', requireAuth, requirePermission('ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER'), validate({ body: priceChangeSchema }), c.changePrice);

module.exports = r;
