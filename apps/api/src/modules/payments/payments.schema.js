const { z } = require('zod');
const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
const createSchema = z.object({
  invoice_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  method: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'ONLINE', 'CREDIT_NOTE']).default('BANK_TRANSFER'),
  reference: z.string().max(200).optional(),
  payment_date: z.string().datetime().optional(),
}).strict();
const reverseSchema = z.object({
  reason: z.string().trim().min(10).max(500),
  confirming_officer_email: z.string().email().optional(),
  confirming_officer_password: z.string().min(1).max(200).optional(),
}).strict();
module.exports = { idParamSchema, createSchema, reverseSchema };
