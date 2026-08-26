const { z } = require('zod');

// Field names/enums here must match the real `products` table (migration 0004):
// sku, name, description, category_id, supplier_id, product_type, unit_size,
// base_price, moq, stock_qty, reorder_level, status, bloom_video_url.
const createSchema = z.object({
  // sku is OPTIONAL: when the operator leaves it blank the server generates a
  // type-prefixed, collision-safe SKU (see products.service.create).
  sku: z.string().trim().min(2).max(50).optional(),
  name: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(),
  category_id: z.coerce.number().int().positive(),
  supplier_id: z.coerce.number().int().positive(),
  product_type: z.enum(['ORCHID', 'FERTILIZER', 'SUPPLY', 'OTHER']).default('OTHER'),
  unit_size: z.string().max(100).optional(),
  base_price: z.number().positive(),
  moq: z.number().int().min(1).default(1),
  stock_qty: z.number().int().min(0).default(0),
  reorder_level: z.number().int().min(0).default(10),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']).default('ACTIVE'),
  bloom_video_url: z.string().url().optional().nullable(),
}).strict();

const updateSchema = z.object({
  // sku is immutable after creation (Part C spec) — deliberately excluded here.
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(5000).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  product_type: z.enum(['ORCHID', 'FERTILIZER', 'SUPPLY', 'OTHER']).optional(),
  unit_size: z.string().max(100).optional(),
  moq: z.number().int().min(1).optional(),
  reorder_level: z.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']).optional(),
  bloom_video_url: z.string().url().optional().nullable(),
  // base_price / stock_qty deliberately excluded: they go through the governed
  // price-change and stock-movement endpoints, never a bare field edit.
}).strict();

// Note: strict-increasing/decreasing ordering is checked in the service layer,
// not via .refine() here — validate.js calls schema.body.strict(), which only
// exists on a plain ZodObject (a .refine() wrapper returns a ZodEffects).
const bulkTiersSchema = z.object({
  tiers: z.array(z.object({
    min_quantity: z.number().int().min(1),
    unit_price: z.number().positive(),
  })).max(20),
}).strict();

const stockAdjustmentSchema = z.object({
  type: z.enum(['RECEIVE', 'DEDUCT', 'RESTOCK', 'WRITE_OFF', 'RESERVATION_CONVERT']),
  quantity: z.number().int().min(1),
  note: z.string().max(500).optional(),
  reference_type: z.string().optional(),
  reference_id: z.string().optional(),
}).strict();

const priceChangeSchema = z.object({
  new_price: z.number().min(0),
  reason: z.string().trim().min(5).max(500),
}).strict();

const bulkActionSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1),
  action: z.enum(['hide', 'show']),
}).strict();

module.exports = { createSchema, updateSchema, stockAdjustmentSchema, priceChangeSchema, bulkActionSchema, bulkTiersSchema };
