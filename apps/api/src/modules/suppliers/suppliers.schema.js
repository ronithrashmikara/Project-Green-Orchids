const { z } = require('zod');
const createSchema = z.object({
  name: z.string().min(2).max(200),
  contact_person: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  address: z.string().max(500).optional(),
  payment_terms: z.string().max(200).optional(),
  lead_time_days: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
}).strict();
const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  contact_person: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  address: z.string().max(500).optional(),
  payment_terms: z.string().max(200).optional(),
  lead_time_days: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
}).strict();
module.exports = { createSchema, updateSchema };
