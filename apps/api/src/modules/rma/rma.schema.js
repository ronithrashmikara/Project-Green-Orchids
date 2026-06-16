const { z } = require('zod');
const createSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  reason: z.string().min(20).max(1000),
  return_type: z.enum(['DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'NOT_AS_DESCRIBED', 'OTHER']).default('OTHER'),
  notes: z.string().max(500).optional(),
}).strict();
const rejectSchema = z.object({ reason: z.string().min(10).max(500) }).strict();
const receiveSchema = z.object({
  disposition: z.enum(['RESTOCK', 'WRITE_OFF']).default('RESTOCK'),
  notes: z.string().max(500).optional(),
}).strict();
const resolveSchema = z.object({
  resolution: z.enum(['REFUND', 'CREDIT_NOTE', 'REPLACEMENT', 'OTHER']),
  adjustment_amount: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
}).strict();
module.exports = { createSchema, rejectSchema, receiveSchema, resolveSchema };
