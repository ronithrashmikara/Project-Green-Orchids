const { z } = require('zod');
const paySchema = z.object({
  amount: z.coerce.number().positive().optional(),
}).strict();
module.exports = { paySchema };
