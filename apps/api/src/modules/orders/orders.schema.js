const { z } = require('zod');
const createSchema = z.object({ notes: z.string().max(1000).optional() }).strict();
const createFromRfqSchema = z.object({ rfq_id: z.coerce.number().int().positive() }).strict();
const rejectSchema = z.object({ reason: z.string().min(10).max(500) }).strict();
const cancelSchema = z.object({ reason: z.string().max(500).optional() }).strict();
const returnSchema = z.object({
  order_item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  reason: z.string().min(20).max(1000),
  return_type: z.enum(['DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'NOT_AS_DESCRIBED', 'OTHER']).default('OTHER'),
}).strict();
module.exports = { createSchema, createFromRfqSchema, rejectSchema, cancelSchema, returnSchema };
