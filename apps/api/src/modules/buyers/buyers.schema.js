const { z } = require('zod');

const approveSchema = z.object({
  tier: z.enum(['SILVER', 'GOLD', 'PLATINUM']).default('SILVER'),
  credit_limit: z.number().min(0),
  payment_terms: z.enum(['NET_15', 'NET_30', 'NET_45', 'NET_60']).default('NET_30'),
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
  tier: z.enum(['SILVER', 'GOLD', 'PLATINUM']),
  reason: z.string().min(5).max(500),
}).strict();

module.exports = { approveSchema, rejectSchema, suspendSchema, creditUpdateSchema, tierUpdateSchema };
