const { z } = require('zod');
const paySchema = z.object({
  amount: z.coerce.number().positive().optional(),
}).strict();

// Statement month must be a real YYYY-MM value (Audit F10): the controller
// splits it into numbers and interpolates them into a date string, so anything
// non-numeric previously produced an opaque 500 from Postgres date casting.
const statementQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be in YYYY-MM format').optional(),
  buyerId: z.string().uuid().optional(),
}).strict();

module.exports = { paySchema, statementQuerySchema };
