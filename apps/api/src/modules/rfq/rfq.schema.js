const { z } = require('zod');
const createSchema = z.object({
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    product_id: z.coerce.number().int().positive(),
    quantity: z.number().int().min(1),
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
const declineSchema = z.object({ reason: z.string().min(10).max(500) }).strict();
module.exports = { createSchema, reviewSchema, quoteSchema, declineSchema };
