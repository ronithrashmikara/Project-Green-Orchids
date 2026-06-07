const { z } = require('zod');
const ackSchema = z.object({ note: z.string().max(500).optional() }).strict();
module.exports = { ackSchema };
