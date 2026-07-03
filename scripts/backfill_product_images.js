#!/usr/bin/env node
/**
 * backfill_product_images.js – Fixes product images on an already-seeded DB
 * without wiping orders/users/etc. Replaces dead Cloudinary URLs (and fills in
 * missing rows) using the local catalogue photos in
 * apps/web/public/images/catalogue/. Safe to re-run.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/backfill_product_images.js
 */

const { Pool } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/project_green';

const CATEGORY_IMAGE_MAP = {
  'Cattleya':            { num: 1,  slug: 'cattleya' },
  'Cymbidium':           { num: 2,  slug: 'cymbidium' },
  'Dendrobium':          { num: 3,  slug: 'dendrobium' },
  'Oncidium':            { num: 4,  slug: 'oncidium' },
  'Paphiopedilum':       { num: 5,  slug: 'paphiopedilum' },
  'Phalaenopsis':        { num: 6,  slug: 'phalaenopsis' },
  'Vanda':               { num: 7,  slug: 'vanda' },
  'Other Orchids':       { num: 8,  slug: 'other-orchids' },
  'Granular Fertilizer': { num: 9,  slug: 'granular-fertilizer' },
  'Liquid Fertilizer':   { num: 10, slug: 'liquid-fertilizer' },
  'Organic Fertilizer':  { num: 11, slug: 'organic-fertilizer' },
  'Pots':                { num: 12, slug: 'pots' },
  'Media':               { num: 14, slug: 'media' },
  'Tools':               { num: 13, slug: 'tools' },
};

const NAMED_PRODUCT_IMAGE_MAP = {
  "Phalaenopsis 'Moth Orchid White'": '01-phalaenopsis-moth-white.png',
  "Phalaenopsis 'Pink Fairy'":        '02-phalaenopsis-pink-fairy.png',
  "Dendrobium 'Sonia Red'":           '03-dendrobium-sonia-red.png',
  "Cattleya 'Purple Queen'":          '04-cattleya-purple-queen.png',
  "Vanda 'Blue Magic'":               '05-vanda-blue-magic.png',
  "Vanda 'Miss Joaquim'":             '06-vanda-miss-joaquim.png',
  "Oncidium 'Golden Shower'":         '07-oncidium-golden-shower.png',
  "Paphiopedilum 'Venus Slipper'":    '08-paphiopedilum-venus-slipper.png',
  "Cymbidium 'Ruby Red'":             '09-cymbidium-ruby-red.png',
  "Zygopetalum 'Blue Nectar'":        '10-zygopetalum-blue-nectar.png',
};

function catalogueImageUrl(productId, productName, catName) {
  const namedFile = NAMED_PRODUCT_IMAGE_MAP[productName];
  if (namedFile) return `/images/catalogue/named/${namedFile}`;

  const mapped = CATEGORY_IMAGE_MAP[catName];
  if (!mapped) return null;
  const variant = (productId % 5) + 1;
  return `/images/catalogue/${String(mapped.num).padStart(2, '0')}-${mapped.slug}-${variant}.png`;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const { rows: products } = await pool.query(`
      SELECT p.id, p.name, c.name AS category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
    `);

    let updated = 0;
    let inserted = 0;
    let skipped = 0;

    for (const p of products) {
      const url = catalogueImageUrl(p.id, p.name, p.category_name);
      if (!url) { skipped++; continue; }

      const { rows: existing } = await pool.query(
        'SELECT id FROM product_images WHERE product_id = $1 AND is_primary = true',
        [p.id]
      );

      if (existing.length) {
        await pool.query(
          'UPDATE product_images SET cloudinary_public_id = NULL, url = $2 WHERE id = $1',
          [existing[0].id, url]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO product_images (product_id, cloudinary_public_id, url, is_primary, sort_order)
           VALUES ($1, NULL, $2, true, 0)`,
          [p.id, url]
        );
        inserted++;
      }
    }

    console.log(`✅ Backfill complete: ${updated} updated, ${inserted} inserted, ${skipped} skipped (no category mapping) out of ${products.length} products.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
