const { z } = require('zod');

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(100),
  role_id: z.coerce.number().int().positive(),
  send_setup_email: z.boolean().default(true),
  password: z.string().min(8).max(72).optional(),
}).strict();

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  role_id: z.coerce.number().int().positive().optional(),
}).strict();

module.exports = { createUserSchema, updateUserSchema };
