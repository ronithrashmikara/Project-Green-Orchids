const { query } = require('../../config/db');

// The real cms_blocks table only has key/type/content(jsonb)/is_published/updated_by —
// display fields like title/image_url/link_url/start_date/end_date/meta are folded into the
// jsonb `content` blob instead of being separate columns (see cms.schema.js for why).
function normalizeType(data, fallback) {
  return data.type || data.block_type || fallback || 'TEXT';
}

function extraContentFields(data) {
  const extra = {};
  for (const k of ['title', 'image_url', 'link_url', 'start_date', 'end_date', 'meta']) {
    if (data[k] !== undefined) extra[k] = data[k];
  }
  return extra;
}

function parseContent(content) {
  if (content == null) return {};
  if (typeof content === 'string') {
    try { return JSON.parse(content); } catch (_) { return { text: content }; }
  }
  return content;
}

function buildContent(data, base = {}) {
  const provided = data.content !== undefined ? parseContent(data.content) : {};
  return { ...base, ...provided, ...extraContentFields(data) };
}

const repo = {
  async findAll(includeUnpublished) {
    const where = includeUnpublished ? '' : 'WHERE is_published = true';
    return (await query(`SELECT * FROM cms_blocks ${where} ORDER BY updated_at DESC`)).rows;
  },
  async findByKey(key) { const r = await query('SELECT * FROM cms_blocks WHERE key = $1', [key]); return r.rows[0] || null; },
  async create(data, actorId) {
    const r = await query(
      'INSERT INTO cms_blocks (key, type, content, is_published, updated_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [data.key, normalizeType(data), JSON.stringify(buildContent(data)), data.is_published || false, actorId || null],
    );
    return r.rows[0];
  },
  async update(key, data, actorId) {
    const existing = await this.findByKey(key);
    if (!existing) return null;
    const type = normalizeType(data, existing.type);
    const content = buildContent(data, parseContent(existing.content));
    const isPublished = data.is_published !== undefined ? data.is_published : existing.is_published;
    const r = await query(
      'UPDATE cms_blocks SET type=$1, content=$2, is_published=$3, updated_by=$4, updated_at=NOW() WHERE key=$5 RETURNING *',
      [type, JSON.stringify(content), isPublished, actorId || null, key],
    );
    return r.rows[0];
  },
  async togglePublish(key, isPublished) {
    await query('UPDATE cms_blocks SET is_published=$1,updated_at=NOW() WHERE key=$2', [isPublished, key]);
  },

  async findAllMedia() {
    return (await query('SELECT * FROM cms_media ORDER BY created_at DESC')).rows;
  },
  async findMediaById(id) {
    const r = await query('SELECT * FROM cms_media WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  async createMedia(data) {
    const r = await query(
      `INSERT INTO cms_media (filename, url, mime_type, size_bytes, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.filename, data.url, data.mime_type, data.size_bytes, data.uploaded_by]
    );
    return r.rows[0];
  },
  async removeMedia(id) {
    const r = await query('DELETE FROM cms_media WHERE id = $1 RETURNING *', [id]);
    return r.rows[0] || null;
  },
};
module.exports = repo;
