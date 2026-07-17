const { z } = require('zod');
const availabilitySchema = z.object({
  status: z.enum(['AVAILABLE', 'AWAY']),
}).strict();
module.exports = { availabilitySchema };
