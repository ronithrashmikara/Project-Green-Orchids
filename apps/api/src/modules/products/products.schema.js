const { z } = require('zod');

const createSchema = z.object({
  name: z.string().min(2).max(200),
  display_name: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  product_type: z.enum(['CUT_FLOWER', 'POTTED_PLANT', 'TISSUE_CULTURE', 'BULB', 'ACCESSORY', 'OTHER']).default('CUT_FLOWER'),
  category: z.string().max(100).optional(),
  genus: z.string().max(100).optional(),
  species: z.string().max(100).optional(),
  hybrid_name: z.string().max(200).optional(),
  color: z.string().max(100).optional(),
  supplier_id: z.string().uuid().optional(),
  base_price: z.number().min(0),
  unit: z.enum(['STEM', 'BUNCH', 'PLANT', 'FLASK', 'PIECE', 'KG', 'PACK', 'BOX']).default('STEM'),
  stock_qty: z.number().int().min(0).default(0),
  reorder_level: z.number().int().min(0).default(10),
  moq: z.number().int().min(1).default(1),
  is_active: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.any()).optional(),
}).strict();

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  display_name: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  product_type: z.enum(['CUT_FLOWER', 'POTTED_PLANT', 'TISSUE_CULTURE', 'BULB', 'ACCESSORY', 'OTHER']).optional(),
  category: z.string().max(100).optional(),
  genus: z.string().max(100).optional(),
  species: z.string().max(100).optional(),
  hybrid_name: z.string().max(200).optional(),
  color: z.string().max(100).optional(),
  supplier_id: z.string().uuid().optional().nullable(),
  base_price: z.number().min(0).optional(),
  unit: z.enum(['STEM', 'BUNCH', 'PLANT', 'FLASK', 'PIECE', 'KG', 'PACK', 'BOX']).optional(),
  stock_qty: z.number().int().min(0).optional(),
  reorder_level: z.number().int().min(0).optional(),
  moq: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.any()).optional(),
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
  reason: z.string().min(5).max(500),
}).strict();

module.exports = { createSchema, updateSchema, stockAdjustmentSchema, priceChangeSchema };
