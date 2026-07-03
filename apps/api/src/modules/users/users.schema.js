const { z } = require('zod');

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role_id: z.coerce.number().int().positive(),
  send_setup_email: z.boolean().default(true),
}).strict();

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  role_id: z.coerce.number().int().positive().optional(),
}).strict();

module.exports = { createUserSchema, updateUserSchema };
