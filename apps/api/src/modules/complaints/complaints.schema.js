const { z } = require('zod');
const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(['ORDER_ISSUE', 'DELIVERY', 'QUALITY', 'BILLING', 'OTHER']).default('OTHER'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  order_id: z.coerce.number().int().positive().optional(),
}).strict();
const messageSchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict();
// Staff update: status transition and/or claim/reassign. Emptiness is checked in
// the service (validate() re-applies .strict(), so no .refine() here).
const updateSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
}).strict();
module.exports = { createSchema, messageSchema, updateSchema };
