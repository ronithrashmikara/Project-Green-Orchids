const { z } = require('zod');
const createSchema = z.object({
  invoice_id: z.coerce.number().int().positive(),
  amount: z.number().positive(),
  method: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'ONLINE', 'CREDIT_NOTE']).default('BANK_TRANSFER'),
  reference: z.string().max(200).optional(),
  payment_date: z.string().datetime().optional(),
}).strict();
const reverseSchema = z.object({
  reason: z.string().min(10).max(500),
  confirmed_by: z.string().uuid().optional(),
}).strict();
module.exports = { createSchema, reverseSchema };
