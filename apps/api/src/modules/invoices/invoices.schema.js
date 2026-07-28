const { z } = require('zod');
const paySchema = z.object({
  amount: z.coerce.number().positive().optional(),
}).strict();
const confirmStripeSchema = z.object({
  session_id: z.string().trim().max(255).regex(/^cs_[A-Za-z0-9_]+$/, 'Invalid Stripe Checkout Session id'),
}).strict();
module.exports = { paySchema, confirmStripeSchema };
