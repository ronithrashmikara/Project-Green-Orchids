const { z } = require('zod');

// Real cms_blocks columns (migration 0007/0014): id, key, type, content (jsonb),
// is_published, updated_by. There is no title/image_url/link_url/start_date/end_date/meta
// column on the table — the schema below previously validated against columns that never
// existed, so every create/update 500'd. Those display fields are real and useful, they just
// live inside the jsonb `content` blob (folded in by cms.repository.js), not as flat columns.
const BLOCK_TYPES = ['HERO', 'BANNER', 'TEXT', 'HTML', 'MARKDOWN', 'JSON'];

const createSchema = z.object({
  key: z.string().min(2).max(100).regex(/^[a-z0-9_]+$/),
  type: z.enum(BLOCK_TYPES).optional(),
  block_type: z.enum(BLOCK_TYPES).optional(),
  title: z.string().max(200).optional(),
  content: z.union([z.string().max(10000), z.record(z.any())]).optional(),
  image_url: z.string().url().optional(),
  link_url: z.string().url().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  is_published: z.boolean().default(false),
  meta: z.record(z.any()).optional(),
}).strict();

const updateSchema = z.object({
  type: z.enum(BLOCK_TYPES).optional(),
  block_type: z.enum(BLOCK_TYPES).optional(),
  title: z.string().max(200).optional(),
  content: z.union([z.string().max(10000), z.record(z.any())]).optional(),
  image_url: z.string().url().optional().nullable(),
  link_url: z.string().url().optional().nullable(),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  is_published: z.boolean().optional(),
  meta: z.record(z.any()).optional(),
}).strict();

module.exports = { createSchema, updateSchema };
