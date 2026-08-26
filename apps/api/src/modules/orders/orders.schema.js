const { z } = require('zod');
// Sanity ceiling well above any realistic stock/MOQ scale so legitimate bulk
// returns are never blocked, while still rejecting absurd inputs like 999999+.
const MAX_QUANTITY = 2000000;
// po_reference + notes wired end-to-end by Audit F7 (previously dead UI fields).
const createSchema = z.object({
  po_reference: z.string().trim().min(1).max(100).optional(),
  notes: z.string().max(1000).optional(),
}).strict();
const createFromRfqSchema = z.object({ rfq_id: z.coerce.number().int().positive() }).strict();
const rejectSchema = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
const cancelSchema = z.object({ reason: z.string().max(500).optional() }).strict();
const returnSchema = z.object({
  order_item_id: z.coerce.number().int().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  reason: z.string().trim().min(20).max(1000),
  return_type: z.enum(['DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'SHORT_SHIPPED', 'LATE_DELIVERY', 'BUYER_REMORSE', 'OTHER']).default('OTHER'),
}).strict();
module.exports = { createSchema, createFromRfqSchema, rejectSchema, cancelSchema, returnSchema };
