const { z } = require('zod');
const createSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'PAYHERE', 'CREDIT_CARD', 'OTHER']).default('BANK_TRANSFER'),
  reference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  payment_date: z.string().datetime().optional(),
}).strict();
const reverseSchema = z.object({
  reason: z.string().min(10).max(500),
}).strict();
module.exports = { createSchema, reverseSchema };
