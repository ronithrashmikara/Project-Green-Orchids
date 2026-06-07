const { z } = require('zod');

const approveSchema = z.object({
  tier: z.enum(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4']).default('TIER_1'),
  credit_limit: z.number().min(0),
  payment_terms: z.number().int().min(0).max(120).default(30),
}).strict();

const rejectSchema = z.object({
  reason: z.string().min(10).max(500),
}).strict();

const suspendSchema = z.object({
  reason: z.string().min(10).max(500),
}).strict();

const creditUpdateSchema = z.object({
  credit_limit: z.number().min(0),
  reason: z.string().min(5).max(500),
}).strict();

const tierUpdateSchema = z.object({
  tier: z.enum(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4']),
  reason: z.string().min(5).max(500),
}).strict();

module.exports = { approveSchema, rejectSchema, suspendSchema, creditUpdateSchema, tierUpdateSchema };
