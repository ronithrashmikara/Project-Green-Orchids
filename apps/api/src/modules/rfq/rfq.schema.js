const { z } = require('zod');
// Sanity ceiling well above any realistic stock/MOQ scale so legitimate bulk
// RFQs are never blocked, while still rejecting absurd inputs like 999999+.
const MAX_QUANTITY = 2000000;
const createSchema = z.object({
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    product_id: z.coerce.number().int().positive(),
    quantity: z.number().int().min(1).max(MAX_QUANTITY),
    target_price: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
  })).min(1),
}).strict();
const reviewSchema = z.object({ internal_notes: z.string().max(1000).optional() }).strict();
const quoteSchema = z.object({
  quote_expiry: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    rfq_item_id: z.coerce.number().int().positive(),
    quoted_price: z.number().min(0),
    notes: z.string().max(500).optional(),
  })).min(1),
}).strict();
const declineSchema = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
module.exports = { createSchema, reviewSchema, quoteSchema, declineSchema };
