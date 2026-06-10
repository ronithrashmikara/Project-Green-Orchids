const { z } = require('zod');
const addItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1),
}).strict();
const updateItemSchema = z.object({
  quantity: z.number().int().min(0),
}).strict();
module.exports = { addItemSchema, updateItemSchema };
