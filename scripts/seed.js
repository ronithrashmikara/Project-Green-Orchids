#!/usr/bin/env node
/**
 * seed.js – Deterministic seed script for Project Green (ORCHIDS B2B platform).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/seed.js
 *
 * Default URL: postgresql://postgres:postgres@localhost:5432/project_green
 */

const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/project_green';
faker.seed(42);

const BCRYPT_COST = 10;
const STAFF_PASSWORD_HASH = bcrypt.hashSync('Staff@1234', BCRYPT_COST);
const BUYER_PASSWORD_HASH = bcrypt.hashSync('Buyer@1234', BCRYPT_COST);

const DAYS_OF_ORDERS = 90;
const ORDERS_PER_DAY_MIN = 5;
const ORDERS_PER_DAY_MAX = 15;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function randomInt(min, max) {
  return Math.floor(faker.number.float({ min, max: max + 0.9999 }));
}
function pick(arr) { return arr[randomInt(0, arr.length - 1)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => faker.number.float() - 0.5);
  return shuffled.slice(0, n);
}
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(8, 20), randomInt(0, 59), randomInt(0, 59));
  return d;
}

// ---------------------------------------------------------------------------
// Real orchid names (30)
// ---------------------------------------------------------------------------
const REAL_ORCHIDS = [
  { name: "Phalaenopsis 'Moth Orchid White'",    type: 'ORCHID', unit: '12 cm pot' },
  { name: "Phalaenopsis 'Pink Fairy'",            type: 'ORCHID', unit: '12 cm pot' },
  { name: "Phalaenopsis 'Purple Gem'",            type: 'ORCHID', unit: '10 cm pot' },
  { name: "Phalaenopsis 'Yellow Butterfly'",      type: 'ORCHID', unit: '12 cm pot' },
  { name: "Phalaenopsis 'Phal. Mini Mark'",       type: 'ORCHID', unit: '8 cm pot'  },
  { name: "Dendrobium 'Sonia Red'",               type: 'ORCHID', unit: '15 cm pot' },
  { name: "Dendrobium 'White Fairy'",             type: 'ORCHID', unit: '15 cm pot' },
  { name: "Dendrobium 'Sonia Earsakul'",          type: 'ORCHID', unit: '18 cm pot' },
  { name: "Dendrobium 'Caesar'",                  type: 'ORCHID', unit: '15 cm pot' },
  { name: "Dendrobium 'Blue Sapphire'",           type: 'ORCHID', unit: '15 cm pot' },
  { name: "Cattleya 'Purple Queen'",              type: 'ORCHID', unit: '15 cm pot' },
  { name: "Cattleya 'Warneri Alba'",              type: 'ORCHID', unit: '18 cm pot' },
  { name: "Cattleya 'Laelia Hybrid Golden'",      type: 'ORCHID', unit: '15 cm pot' },
  { name: "Cattleya 'Trianae'",                   type: 'ORCHID', unit: '20 cm pot' },
  { name: "Vanda 'Blue Magic'",                   type: 'ORCHID', unit: '25 cm basket' },
  { name: "Vanda 'Miss Joaquim'",                 type: 'ORCHID', unit: '25 cm basket' },
  { name: "Vanda 'Pachara Delight'",              type: 'ORCHID', unit: '30 cm basket' },
  { name: "Vanda 'Gordon Dillon'",                type: 'ORCHID', unit: '25 cm basket' },
  { name: "Oncidium 'Sweet Sugar'",               type: 'ORCHID', unit: '12 cm pot' },
  { name: "Oncidium 'Sharry Baby'",               type: 'ORCHID', unit: '12 cm pot' },
  { name: "Oncidium 'Golden Shower'",             type: 'ORCHID', unit: '15 cm pot' },
  { name: "Oncidium 'Volcano Queen'",             type: 'ORCHID', unit: '12 cm pot' },
  { name: "Paphiopedilum 'Venus Slipper'",        type: 'ORCHID', unit: '12 cm pot' },
  { name: "Brassia 'Spider Orchid'",              type: 'ORCHID', unit: '15 cm pot' },
  { name: "Miltonia 'Pansy Orchid'",              type: 'ORCHID', unit: '12 cm pot' },
  { name: "Cymbidium 'Golden Globe'",             type: 'ORCHID', unit: '20 cm pot' },
  { name: "Epidendrum 'Star Orchid'",             type: 'ORCHID', unit: '15 cm pot' },
  { name: "Zygopetalum 'Blue Nectar'",            type: 'ORCHID', unit: '12 cm pot' },
  { name: "Cymbidium 'Ruby Red'",                 type: 'ORCHID', unit: '20 cm pot' },
  { name: "Masdevallia 'Fire Opal'",              type: 'ORCHID', unit: '10 cm pot' },
];

// ---------------------------------------------------------------------------
// Supplier names
// ---------------------------------------------------------------------------
const SUPPLIER_NAMES = [
  { name: 'Green Island Nurseries',   person: 'Rohan Perera',     phone: '+94-77-100-2001', email: 'rohan@greenisland-nursery.example.invalid' },
  { name: 'Kandy Orchid Gardens',     person: 'Kumari Wickram',   phone: '+94-77-100-2002', email: 'kumari@kandy-orchids.example.invalid' },
  { name: 'LankaBloom Exports',       person: 'Dinesh Fernando',  phone: '+94-77-100-2003', email: 'dinesh@lankabloom.example.invalid' },
  { name: 'Tropical Orchid Paradise', person: 'Anusha Silva',     phone: '+94-77-100-2004', email: 'anusha@trop-orchid.example.invalid' },
  { name: 'Ceylon Agro Supplies',     person: 'Mohan Rajapaksa',  phone: '+94-77-100-2005', email: 'mohan@ceylonagro.example.invalid' },
  { name: 'Hill Country Nursery',     person: 'Wathsala Bandara', phone: '+94-77-100-2006', email: 'wathsala@hillcountry-nursery.example.invalid' },
];

// ---------------------------------------------------------------------------
// Categories tree
// ---------------------------------------------------------------------------
const CATEGORY_TREE = {
  'Orchids': [
    'Phalaenopsis',
    'Dendrobium',
    'Cattleya',
    'Vanda',
    'Oncidium',
    'Paphiopedilum',
    'Cymbidium',
    'Other Orchids',
  ],
  'Fertilizer': [
    'Liquid Fertilizer',
    'Granular Fertilizer',
    'Organic Fertilizer',
  ],
  'Supplies': [
    'Pots',
    'Media',
    'Tools',
  ],
};

// ---------------------------------------------------------------------------
// Catalogue images — 70 AI-generated product photos (5 per category) live in
// apps/web/public/images/catalogue/, named `{catNum}-{slug}-{variant}.png`.
// 10 named orchids also have a specific hero shot in the `named/` subfolder.
// ---------------------------------------------------------------------------
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

// Returns a stable local image URL for a product, or null if its category has
// no catalogue image mapped (shouldn't happen — all 14 leaf categories are covered).
function catalogueImageUrl(productId, productName, catName) {
  const namedFile = NAMED_PRODUCT_IMAGE_MAP[productName];
  if (namedFile) return `/images/catalogue/named/${namedFile}`;

  const mapped = CATEGORY_IMAGE_MAP[catName];
  if (!mapped) return null;
  const variant = (productId % 5) + 1;
  return `/images/catalogue/${String(mapped.num).padStart(2, '0')}-${mapped.slug}-${variant}.png`;
}

// ---------------------------------------------------------------------------
// Clear existing data
// ---------------------------------------------------------------------------
async function clearData(pool) {
  // categories has self-referencing FK; null children first
  await pool.query('UPDATE categories SET parent_id = NULL');

  // The audit/ledger tables are append-only at runtime. Seeding is the one
  // controlled reset path, so temporarily disable only user-defined triggers.
  const appendOnlyTables = ['audit_logs', 'stock_movements', 'price_history'];
  for (const table of appendOnlyTables) {
    await pool.query(`ALTER TABLE ${table} DISABLE TRIGGER USER`);
  }

  // Delete in reverse dependency order (children before parents)
  const tables = [
    'complaint_messages',
    'complaints',
    'staff_availability',
    'delivery_events',
    'deliveries',
    'rma_items',
    'invoice_adjustments',
    'rma_requests',
    'payments',
    'invoices',
    'stock_movements',
    'order_items',
    'orders',
    'cart_items',
    'carts',
    'rfq_items',
    'rfqs',
    'price_change_requests',
    'price_history',
    'bulk_pricing_tiers',
    'product_images',
    'stock_alerts',
    'bloom_events',
    'products',
    'categories',
    'suppliers',
    'trade_accounts',
    'auth_sessions',
    'email_tokens',
    'login_history',
    'cms_blocks',
    'cms_media',
    'users',
    'role_access_windows',
    'role_permissions',
    'permissions',
    'roles',
    'notifications_outbox',
    'audit_logs',
    'settings',
    'buyer_tiers',
  ];

  try {
    for (const table of tables) {
      try {
        await pool.query(`DELETE FROM ${table}`);
      } catch (err) {
        // 42P01 = undefined_table: tolerate tables from migrations not yet applied
        // (e.g. complaints/staff_availability from 0016 on an older database).
        if (err.code !== '42P01') throw err;
      }
    }

    // Reset sequences
    const sequences = [
      'roles_id_seq', 'permissions_id_seq',
      'categories_id_seq', 'suppliers_id_seq',
      'products_id_seq', 'product_images_id_seq',
      'bulk_pricing_tiers_id_seq',
      'orders_id_seq', 'order_items_id_seq',
      'invoices_id_seq', 'payments_id_seq',
      'invoice_adjustments_id_seq',
      'rma_requests_id_seq', 'rma_items_id_seq',
      'deliveries_id_seq', 'delivery_events_id_seq',
      'stock_alerts_id_seq',
      'price_change_requests_id_seq',
      'complaints_id_seq', 'complaint_messages_id_seq',
    ];
    for (const seq of sequences) {
      try {
        await pool.query(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1`);
      } catch (_) { /* may not exist yet */ }
    }
  } finally {
    for (const table of appendOnlyTables) {
      await pool.query(`ALTER TABLE ${table} ENABLE TRIGGER USER`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🧹 Clearing existing data…');
    await clearData(pool);
    console.log('✅ Data cleared.\n');

    // ---- 1. Buyer tiers ----
    console.log('📊 Seeding buyer tiers…');
    const tierRes = await pool.query(`
      INSERT INTO buyer_tiers (name, discount_rate, credit_cap, priority) VALUES
        ('SILVER',  3.00, 40000000.00,  1),
        ('GOLD',    5.00, 60000000.00, 2),
        ('PLATINUM',7.00, 90000000.00, 3)
      RETURNING id, name, discount_rate, credit_cap
    `);
    const tiers = {};
    for (const t of tierRes.rows) tiers[t.name] = t;
    console.log(`   → ${Object.keys(tiers).join(', ')}`);

    // ---- 2. Roles & permissions ----
    console.log('🛡️  Seeding roles & permissions…');
    // Run 0002 migration (idempotent)
    const fs = require('fs');
    const path = require('path');
    const migDir = path.resolve(__dirname, '..', 'apps', 'api', 'migrations');
    const sql0002 = fs.readFileSync(path.join(migDir, '0002_roles_permissions.sql'), 'utf8');
    await pool.query(sql0002);
    // 0016 adds the SALES_MANAGER role + complaint/availability permissions
    // (idempotent, so re-running the whole file here is safe).
    const sql0016 = fs.readFileSync(path.join(migDir, '0016_sales_managers_complaints.sql'), 'utf8');
    await pool.query(sql0016);

    const { rows: rolesList } = await pool.query('SELECT id, name FROM roles');
    const roleMap = {};
    for (const r of rolesList) roleMap[r.name] = r.id;
    console.log(`   → ${Object.keys(roleMap).join(', ')}`);

    // ---- 3. Staff users ----
    console.log('👤 Seeding staff users…');
    const staffDefs = [
      { email: 'admin@example.invalid',         name: 'Admin User',          role: 'ADMIN' },
      { email: 'buyer@example.invalid',         name: 'Trade Account',       role: 'TRADE_BUYER' },
      { email: 'inventory@example.invalid',     name: 'Inventory Manager',   role: 'INVENTORY_MANAGER' },
      { email: 'finance@example.invalid',        name: 'Finance Officer',     role: 'FINANCE_OFFICER' },
      { email: 'delivery@example.invalid',       name: 'Delivery Staff',      role: 'DELIVERY_COORDINATOR' },
    ];

    const staffUsers = {};
    for (const s of staffDefs) {
      const { rows: [u] } = await pool.query(`
        INSERT INTO users (email, password_hash, full_name, role_id, status, email_verified_at)
        VALUES ($1, $2, $3, $4, 'ACTIVE', NOW())
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id, email
      `, [s.email, STAFF_PASSWORD_HASH, s.name, roleMap[s.role]]);
      staffUsers[s.role] = u;
    }

    // Sales managers (two of them, so availability-based assignment is observable):
    // sales1 starts AVAILABLE, sales2 starts AWAY.
    const salesDefs = [
      { email: 'sales1@example.invalid', name: 'Sales Manager One', availability: 'AVAILABLE' },
      { email: 'sales2@example.invalid', name: 'Sales Manager Two', availability: 'AWAY' },
    ];
    const salesManagerUsers = [];
    for (const s of salesDefs) {
      const { rows: [u] } = await pool.query(`
        INSERT INTO users (email, password_hash, full_name, role_id, status, email_verified_at)
        VALUES ($1, $2, $3, $4, 'ACTIVE', NOW())
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id, email
      `, [s.email, STAFF_PASSWORD_HASH, s.name, roleMap['SALES_MANAGER']]);
      await pool.query(`
        INSERT INTO staff_availability (user_id, status, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
      `, [u.id, s.availability]);
      salesManagerUsers.push(u);
    }
    console.log(`   → ${staffDefs.length + salesDefs.length} staff users created (incl. ${salesDefs.length} sales managers)`);

    // ---- 4. Suppliers ----
    console.log('🏭 Seeding suppliers…');
    const supplierIds = [];
    for (const s of SUPPLIER_NAMES) {
      const { rows: [sup] } = await pool.query(`
        INSERT INTO suppliers (name, contact_person, phone, email, address, status, lead_time_days)
        VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6)
        RETURNING id
      `, [s.name, s.person, s.phone, s.email, faker.location.streetAddress(), randomInt(3, 14)]);
      supplierIds.push(sup.id);
    }
    console.log(`   → ${supplierIds.length} suppliers`);

    // ---- 5. Categories ----
    console.log('📁 Seeding categories…');
    const categoryIds = {}; // name → id
    for (const [parent, children] of Object.entries(CATEGORY_TREE)) {
      const { rows: [p] } = await pool.query(`
        INSERT INTO categories (name, type) VALUES ($1, 'PRODUCT') RETURNING id
      `, [parent]);
      categoryIds[parent] = p.id;
      for (const child of children) {
        const { rows: [c] } = await pool.query(`
          INSERT INTO categories (name, parent_id, type) VALUES ($1, $2, 'PRODUCT') RETURNING id
        `, [child, p.id]);
        categoryIds[child] = c.id;
      }
    }
    console.log(`   → ${Object.keys(categoryIds).length} categories`);

    // Build list of leaf category IDs for random assignment
    const leafCategories = Object.keys(categoryIds).filter(
      k => CATEGORY_TREE[k] === undefined || CATEGORY_TREE[k] === undefined
    );
    // Actually, all entries in CATEGORY_TREE children are leaf categories.
    let allLeafIds = [];
    for (const children of Object.values(CATEGORY_TREE)) {
      for (const child of children) {
        allLeafIds.push(categoryIds[child]);
      }
    }

    // ---- 6. Products ----
    console.log('🌺 Seeding products (520 total)…');

    // Helper to determine product type from category name
    function getProductType(catName) {
      const parent = Object.entries(CATEGORY_TREE).find(
        ([, children]) => children.includes(catName)
      );
      if (!parent) return 'OTHER';
      if (parent[0] === 'Orchids') return 'ORCHID';
      if (parent[0] === 'Fertilizer') return 'FERTILIZER';
      if (parent[0] === 'Supplies') return 'SUPPLY';
      return 'OTHER';
    }

    // 6a. Real orchid products (30)
    const realProductIds = [];
    const productMeta = {}; // pid -> { name, catName }
    for (let i = 0; i < REAL_ORCHIDS.length; i++) {
      const orchid = REAL_ORCHIDS[i];
      const sku = `KOR-${String(i + 1).padStart(4, '0')}`;
      const catName = orchid.name.split(' ')[0]; // "Phalaenopsis", "Dendrobium", etc.
      // Map to correct category
      const catMap = {
        'Phalaenopsis': 'Phalaenopsis',
        'Dendrobium': 'Dendrobium',
        'Cattleya': 'Cattleya',
        'Vanda': 'Vanda',
        'Oncidium': 'Oncidium',
        'Paphiopedilum': 'Paphiopedilum',
        'Brassia': 'Other Orchids',
        'Miltonia': 'Other Orchids',
        'Cymbidium': 'Cymbidium',
        'Epidendrum': 'Other Orchids',
        'Zygopetalum': 'Other Orchids',
        'Masdevallia': 'Other Orchids',
      };
      const catId = categoryIds[catMap[catName] || 'Other Orchids'];
      const basePrice = randomInt(500, 25000);
      const moq = randomInt(1, 5);
      const stockQty = randomInt(10, 500);
      const reservedQty = randomInt(0, Math.floor(stockQty * 0.3));

      const { rows: [p] } = await pool.query(`
        INSERT INTO products (sku, name, description, category_id, supplier_id, product_type,
                              unit_size, base_price, moq, stock_qty, reserved_qty, reorder_level, status)
        VALUES ($1,$2,$3,$4,$5,'ORCHID',$6,$7,$8,$9,$10,$11,'ACTIVE')
        RETURNING id
      `, [
        sku, orchid.name, `${orchid.name} - premium quality orchid from the Orchids collection`,
        catId, pick(supplierIds), orchid.unit, basePrice, moq,
        stockQty, reservedQty, Math.floor(stockQty * 0.2),
      ]);
      realProductIds.push(p.id);
      productMeta[p.id] = { name: orchid.name, catName: catMap[catName] || 'Other Orchids' };
    }

    // 6b. Faker-generated products (490)
    const allProductIds = [...realProductIds];
    const flowerAdjectives = ['Premium','Deluxe','Royal','Exotic','Classic','Mini','Giant','Double','Variegated','Fragrant'];
    const fertilizerNames = ['Bloom Booster','Orchid Focus','Root Growth','NPK 20-20-20','Seaweed Extract','Calcium Plus','Flower Power','Orchid Magic','Green Boost','Growth Formula'];
    const supplyNames = ['Ceramic Pot','Hanging Basket','Orchid Mix','Sphagnum Moss','Bark Chips','Coconut Husk','Fertilizer Spoon','Misting Bottle','Pruning Shear','Plant Labels'];

    for (let i = 0; i < 490; i++) {
      const catName = pick(Object.keys(categoryIds).filter(k => allLeafIds.includes(categoryIds[k])));
      const catId = categoryIds[catName];
      const pType = getProductType(catName);

      let productName, description;
      if (pType === 'ORCHID') {
        const adj = pick(flowerAdjectives);
        productName = `${adj} ${catName} Hybrid #${randomInt(100, 999)}`;
        description = `${productName} - ${adj.toLowerCase()} blooming orchid, ideal for wholesale buyers`;
      } else if (pType === 'FERTILIZER') {
        productName = pick(fertilizerNames) + ' ' + randomInt(250, 5000) + 'ml';
        description = `${productName} - professional-grade ${catName.toLowerCase()} for orchid cultivation`;
      } else {
        productName = pick(supplyNames) + ' ' + randomInt(1, 50);
        description = `${productName} - essential ${catName.toLowerCase()} for orchid growers`;
      }

      const sku = `KOR-${String(i + 31).padStart(4, '0')}`;
      const basePrice = pType === 'ORCHID'
        ? randomInt(500, 25000)
        : randomInt(200, 5000);
      const moq = randomInt(1, 10);
      const stockQty = randomInt(0, 500);
      const reservedQty = randomInt(0, Math.min(stockQty, Math.floor(stockQty * 0.3)));
      const status = faker.number.float({min:0,max:1}) < 0.92 ? 'ACTIVE' : pick(['INACTIVE','DISCONTINUED','OUT_OF_STOCK']);
      const unitSize = pType === 'ORCHID' ? pick(['8 cm pot','10 cm pot','12 cm pot','15 cm pot','20 cm pot','25 cm basket']) :
                       pType === 'FERTILIZER' ? pick(['250ml','500ml','1L','5L']) :
                       pick(['pack of 10','pack of 25','pack of 50','single']);

      const { rows: [p] } = await pool.query(`
        INSERT INTO products (sku, name, description, category_id, supplier_id, product_type,
                              unit_size, base_price, moq, stock_qty, reserved_qty, reorder_level, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id
      `, [
        sku, productName, description, catId, pick(supplierIds), pType, unitSize,
        basePrice, moq, stockQty, reservedQty, Math.max(1, Math.floor(stockQty * 0.1)), status,
      ]);
      allProductIds.push(p.id);
      productMeta[p.id] = { name: productName, catName };
    }
    console.log(`   → ${allProductIds.length} products (${realProductIds.length} real orchids + ${allProductIds.length - realProductIds.length} generated)`);

    // ---- 7. Bulk pricing tiers ----
    console.log('💰 Seeding bulk pricing tiers…');
    let bulkCount = 0;
    for (const pid of allProductIds) {
      const { rows: [prod] } = await pool.query(
        'SELECT base_price, moq FROM products WHERE id = $1', [pid]
      );
      const tiers = randomInt(2, 3);
      const existingQtys = new Set();
      for (let t = 0; t < tiers; t++) {
        let minQty;
        do {
          minQty = [5, 10, 25, 50, 100, 250, 500][randomInt(0, 6)];
        } while (minQty <= prod.moq || existingQtys.has(minQty));
        existingQtys.add(minQty);

        const discount = randomInt(5, 20) / 100;
        const unitPrice = Math.round(parseFloat(prod.base_price) * (1 - discount) * 100) / 100;

        // skip duplicates
        await pool.query(`
          INSERT INTO bulk_pricing_tiers (product_id, min_quantity, unit_price)
          VALUES ($1,$2,$3)
          ON CONFLICT (product_id, min_quantity) DO NOTHING
        `, [pid, minQty, unitPrice]);
        bulkCount++;
      }
    }
    console.log(`   → ~${bulkCount} bulk price tiers`);

    // ---- 8. Product images for ALL products ----
    // Uses local catalogue photos in apps/web/public/images/catalogue/ instead of
    // the old Cloudinary bucket (those URLs 404 — nothing was ever uploaded there).
    console.log('🖼️  Seeding product images…');
    let imageCount = 0;
    let imageSkipped = 0;
    for (const pid of allProductIds) {
      const meta = productMeta[pid];
      const url = catalogueImageUrl(pid, meta.name, meta.catName);
      if (!url) { imageSkipped++; continue; }
      await pool.query(`
        INSERT INTO product_images (product_id, cloudinary_public_id, url, is_primary, sort_order)
        VALUES ($1, NULL, $2, true, 0)
        ON CONFLICT DO NOTHING
      `, [pid, url]);
      imageCount++;
    }
    console.log(`   → ${imageCount} product images (${imageSkipped} skipped — no category mapping)`);

    // ---- 9. Trade buyers ----
    console.log('🏢 Seeding trade buyers…');
    const buyerDetails = [
      { em: 'buyer1@example.invalid', name: 'Oceanic Florist Ltd',    tier: 'SILVER',   term: 'NET_15', status: 'ACTIVE', score: 4.8 },
      { em: 'buyer2@example.invalid', name: 'City Blooms Corporation', tier: 'SILVER',  term: 'NET_30', status: 'ACTIVE', score: 4.2 },
      { em: 'buyer3@example.invalid', name: 'Green Valley Exports',   tier: 'GOLD',     term: 'NET_30', status: 'ACTIVE', score: 4.9 },
      { em: 'buyer4@example.invalid', name: 'Royal Garden Supplies',  tier: 'GOLD',     term: 'NET_45', status: 'ACTIVE', score: 4.5 },
      { em: 'buyer5@example.invalid', name: 'Lanka Flora Traders',    tier: 'PLATINUM', term: 'NET_60', status: 'ACTIVE', score: 4.7 },
      { em: 'buyer6@example.invalid', name: 'Sunrise Orchid Imports', tier: 'PLATINUM', term: 'NET_60', status: 'ACTIVE', score: 4.6 },
      { em: 'buyer7@example.invalid', name: 'Hanging Gardens Ltd',    tier: 'SILVER',   term: 'NET_30', status: 'SUSPENDED', score: 2.1 },
      { em: 'buyer8@example.invalid', name: 'Petal Pushers Co',       tier: 'SILVER',   term: 'NET_30', status: 'PENDING_APPROVAL', score: 0 },
    ];

    const tradeBuyerUsers = [];
    for (const bd of buyerDetails) {
      const { rows: [u] } = await pool.query(`
        INSERT INTO users (email, password_hash, full_name, role_id, status, email_verified_at)
        VALUES ($1,$2,$3,$4,$5,NOW())
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id
      `, [bd.em, BUYER_PASSWORD_HASH, bd.name, roleMap['TRADE_BUYER'], bd.tier === 'ACTIVE' ? 'ACTIVE' : 'ACTIVE']);

      const creditLimit = tiers[bd.tier].credit_cap;
      const { rows: [ta] } = await pool.query(`
        INSERT INTO trade_accounts (user_id, business_name, business_reg_no, phone, address,
                                     tier_id, credit_limit, payment_term, account_status,
                                     payment_reliability_score, approved_by, approved_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id
      `, [
        u.id, bd.name, `BRN-${randomInt(10000, 99999)}`, faker.phone.number(),
        faker.location.streetAddress(), tiers[bd.tier].id,
        creditLimit, bd.term, bd.status, bd.score,
        bd.status === 'PENDING_APPROVAL' ? null : staffUsers['ADMIN'].id,
        bd.status === 'PENDING_APPROVAL' ? null : new Date(),
      ]);
      tradeBuyerUsers.push({ userId: u.id, accountId: ta.id, tier: bd.tier, status: bd.status, score: bd.score });
    }
    console.log(`   → ${tradeBuyerUsers.length} trade buyers`);

    // ---- 10. 90 days of orders ----
    console.log('📦 Seeding 90 days of orders (this may take a while)…');
    const activeBuyers = tradeBuyerUsers.filter(b => b.status === 'ACTIVE');

    const orderStatusFlow = [
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'PROCESSING',
      'READY_TO_SHIP',
      'DISPATCHED',
      'DELIVERED',
    ];
    const terminalStatuses = ['CANCELLED', 'REJECTED', 'RETURNED'];

    let allOrderIds = [];
    let approvedOrderIds = [];

    for (let day = DAYS_OF_ORDERS; day >= 1; day--) {
      const ordersToday = randomInt(ORDERS_PER_DAY_MIN, ORDERS_PER_DAY_MAX);
      for (let o = 0; o < ordersToday; o++) {
        const buyer = pick(activeBuyers);
        const orderDate = daysAgo(day);

        // Pick a status along the flow based on how old the order is (larger `day` = placed longer ago = further along)
        let statusIdx = Math.min(Math.floor(day / 12), orderStatusFlow.length - 1);
        // Add some randomness
        if (faker.number.float({min:0,max:1}) < 0.15) statusIdx = Math.max(0, statusIdx - 1);
        const status = orderStatusFlow[statusIdx];

        const items = randomInt(1, 5);
        const itemProductIds = pickN(allProductIds, items);

        let subtotal = 0;
        const itemData = [];
        for (const pid of itemProductIds) {
          const { rows: [prod] } = await pool.query(
            'SELECT base_price FROM products WHERE id = $1', [pid]
          );
          const qty = randomInt(1, 30);
          const unitPrice = parseFloat(prod.base_price);
          const lineTotal = Math.round(unitPrice * qty * 100) / 100;
          subtotal += lineTotal;
          itemData.push({ pid, qty, unitPrice, lineTotal });
        }

        const discountPct = parseFloat(tiers[buyer.tier].discount_rate);
        const tierDiscount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
        const total = Math.round((subtotal - tierDiscount) * 100) / 100;

        const orderNo = `ORD-${String(allOrderIds.length + 1).padStart(7, '0')}`;
        const created = orderDate;

        let orderStatus = status;
        let approvedBy = null;
        let approvedAt = null;
        let cancelledBy = null;
        let cancelledAt = null;
        let cancelReason = null;
        let rejectionReason = null;

        // Status-specific adjustments
        const flowIdx = orderStatusFlow.indexOf(status);
        if (flowIdx >= 2) {
          // APPROVED or later
          approvedBy = staffUsers['ADMIN'].id;
          approvedAt = new Date(orderDate.getTime() + randomInt(1, 24) * 3600000);
        }
        if (status === 'CANCELLED') {
          cancelledBy = pick(Object.values(staffUsers)).id;
          cancelledAt = new Date(orderDate.getTime() + randomInt(1, 48) * 3600000);
          cancelReason = pick(['Buyer requested cancellation', 'Out of stock', 'Payment issue']);
          orderStatus = 'CANCELLED';
        } else if (status === 'REJECTED') {
          rejectionReason = pick(['Credit limit exceeded', 'Incomplete documentation', 'Product unavailable']);
          orderStatus = 'REJECTED';
          approvedBy = staffUsers['ADMIN'].id;
          approvedAt = new Date(orderDate.getTime() + randomInt(1, 24) * 3600000);
        }

        const { rows: [order] } = await pool.query(`
          INSERT INTO orders (order_no, buyer_id, source, status, subtotal, tier_discount_amount, total,
                              approved_by, approved_at, rejection_reason, cancelled_by, cancelled_at, cancel_reason,
                              created_at, updated_at)
          VALUES ($1,$2,'DIRECT',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          RETURNING id, status, total, created_at
        `, [
          orderNo, buyer.accountId, orderStatus, subtotal, tierDiscount, total,
          approvedBy, approvedAt, rejectionReason, cancelledBy, cancelledAt, cancelReason,
          created, created,
        ]);

        allOrderIds.push(order.id);

        // Order items
        for (const item of itemData) {
          await pool.query(`
            INSERT INTO order_items (order_id, product_id, qty, unit_price_at_order, price_source, line_total)
            VALUES ($1,$2,$3,$4,'BASE',$5)
          `, [order.id, item.pid, item.qty, item.unitPrice, item.lineTotal]);

          // Stock movement for orders beyond DRAFT
          if (orderStatus !== 'DRAFT') {
            await pool.query(`
              INSERT INTO stock_movements (product_id, movement_type, qty, ref_table, ref_id, performed_by, occurred_at)
              VALUES ($1,'ORDER_RESERVE',$2,'orders',$3,$4,$5)
            `, [item.pid, -item.qty, String(order.id), staffUsers['INVENTORY_MANAGER'].id, created]);
          }
        }

        // ---- 11. Invoices & Payments for approved+ orders ----
        if (['APPROVED','PROCESSING','READY_TO_SHIP','DISPATCHED','DELIVERED','RETURNED'].includes(orderStatus)) {
          approvedOrderIds.push(order.id);

          const invoiceNo = `INV-${String(order.id).padStart(7, '0')}`;
          const dueDate = new Date(orderDate);
          dueDate.setDate(dueDate.getDate() + 30);

          let invoiceStatus = 'PENDING';
          let paidAmount = 0;

          // Payments based on how far along the flow
          if (flowIdx >= 6) {
            // DELIVERED — fully paid
            paidAmount = total;
            invoiceStatus = 'PAID';
          } else if (flowIdx >= 5) {
            // DISPATCHED — partially paid
            paidAmount = Math.round(total * randomInt(40, 90) / 100 * 100) / 100;
            invoiceStatus = paidAmount >= total ? 'PAID' : 'PARTIALLY_PAID';
          } else if (flowIdx >= 4) {
            // READY_TO_SHIP — some payment
            if (faker.number.float({min:0,max:1}) < 0.6) {
              paidAmount = Math.round(total * randomInt(20, 60) / 100 * 100) / 100;
              invoiceStatus = 'PARTIALLY_PAID';
            }
          } else if (flowIdx >= 2) {
            // APPROVED/PROCESSING — maybe overdue if old
            if (day > 35 && faker.number.float({min:0,max:1}) < 0.3) {
              invoiceStatus = 'OVERDUE';
            }
          }

          const balanceDue = Math.round((total - paidAmount) * 100) / 100;

          const { rows: [inv] } = await pool.query(`
            INSERT INTO invoices (invoice_no, order_id, buyer_id, total_amount, paid_amount,
                                  balance_due, due_date, status, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id
          `, [
            invoiceNo, order.id, buyer.accountId, total, paidAmount,
            balanceDue, dueDate.toISOString().split('T')[0], invoiceStatus, created,
          ]);

          // Create payment records for the paid amount
          if (paidAmount > 0) {
            // Potentially split into 1-2 payments
            const numPayments = paidAmount > 50000 ? 2 : 1;
            let remaining = paidAmount;
            for (let p = 0; p < numPayments; p++) {
              const payAmount = p === numPayments - 1
                ? Math.round(remaining * 100) / 100
                : Math.round((paidAmount / numPayments) * randomInt(40, 60) / 100 * 100) / 100;
              remaining -= payAmount;
              if (payAmount <= 0) continue;

              const payNo = `PAY-${String(inv.id).padStart(6, '0')}-${p + 1}`;
              const method = pick(['BANK_TRANSFER','ONLINE','CHEQUE']);
              const ref = `REF-${faker.string.alphanumeric(8).toUpperCase()}`;
              const receivedAt = new Date(orderDate.getTime() + randomInt(1, 14) * 86400000);

              try {
                await pool.query(`
                  INSERT INTO payments (payment_no, invoice_id, buyer_id, amount, method, reference,
                                        recorded_by, received_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                `, [payNo, inv.id, buyer.accountId, payAmount, method, ref,
                    staffUsers['FINANCE_OFFICER'].id, receivedAt]);
              } catch (_) {
                // Skip idempotency violations
              }
            }
          }
        }

        // ---- 12. RMA for some orders ----
        if (['DELIVERED','DISPATCHED'].includes(orderStatus) && faker.number.float({min:0,max:1}) < 0.08) {
          const rmaNo = `RMA-${String(order.id).padStart(7, '0')}`;
          const rmaStatus = pick(['PENDING','APPROVED','REJECTED','RESOLVED']);
          const reasonCat = pick(['DAMAGED','WRONG_ITEM','QUALITY_ISSUE','SHORT_SHIPPED','LATE_DELIVERY','OTHER']);
          const { rows: [rma] } = await pool.query(`
            INSERT INTO rma_requests (rma_no, order_id, buyer_id, status, reason_category, reason_detail, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING id
          `, [rmaNo, order.id, buyer.accountId, rmaStatus, reasonCat, 'Seed-generated RMA', created]);

          // RMA items
          const { rows: oiRows } = await pool.query(
            'SELECT id, product_id, qty FROM order_items WHERE order_id = $1 LIMIT $2',
            [order.id, randomInt(1, 2)]
          );
          for (const oi of oiRows) {
            const rmaQty = randomInt(1, Math.min(oi.qty, 5));
            await pool.query(`
              INSERT INTO rma_items (rma_id, order_item_id, qty)
              VALUES ($1,$2,$3)
            `, [rma.id, oi.id, rmaQty]);
          }

          // Decide RMA if approved/rejected/resolved
          if (['APPROVED','REJECTED','RESOLVED'].includes(rmaStatus)) {
            await pool.query(`
              UPDATE rma_requests
              SET decided_by = $2, decided_at = $3, resolution = $4, updated_at = NOW()
              WHERE id = $1
            `, [rma.id, staffUsers['INVENTORY_MANAGER'].id,
                new Date(created.getTime() + randomInt(1, 5) * 86400000),
                rmaStatus === 'APPROVED' ? 'Return approved, credit to be issued' :
                rmaStatus === 'REJECTED' ? 'Out of RMA window' :
                'Return processed, stock adjusted']);
          }
        }

        // ---- 13. Delivery records ----
        if (['DISPATCHED','DELIVERED','RETURNED'].includes(orderStatus)) {
          const delStatus = orderStatus === 'RETURNED' ? 'FAILED' :
                            orderStatus === 'DELIVERED' ? 'DELIVERED' : 'DISPATCHED';
          const podUrl = delStatus === 'DELIVERED'
            ? `https://res.cloudinary.com/orchids/pod/ORD-${String(order.id).padStart(7, '0')}.pdf`
            : null;
          const { rows: [del] } = await pool.query(`
            INSERT INTO deliveries (order_id, assigned_to, status, dispatch_date, pod_url, pod_uploaded_at,
                                     buyer_confirmed_at, failure_note)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING id
          `, [
            order.id,
            staffUsers['DELIVERY_COORDINATOR'].id,
            delStatus,
            new Date(orderDate.getTime() + randomInt(3, 10) * 86400000),
            podUrl,
            podUrl ? new Date(orderDate.getTime() + randomInt(5, 15) * 86400000) : null,
            delStatus === 'DELIVERED' ? new Date(orderDate.getTime() + randomInt(6, 16) * 86400000) : null,
            delStatus === 'FAILED' ? 'Buyer refused delivery - damaged goods' : null,
          ]);

          // Delivery events
          const events = [
            { status: 'ASSIGNED',   note: 'Coordinator assigned', offset: 1 },
            { status: 'DISPATCHED',  note: 'Goods dispatched from warehouse', offset: 3 },
          ];
          if (delStatus === 'DELIVERED') {
            events.push({ status: 'DELIVERED', note: 'POD uploaded, buyer confirmed', offset: 10 });
          }
          for (const ev of events) {
            await pool.query(`
              INSERT INTO delivery_events (delivery_id, status, note, actor_id, occurred_at)
              VALUES ($1,$2,$3,$4,$5)
            `, [del.id, ev.status, ev.note, staffUsers['DELIVERY_COORDINATOR'].id,
                new Date(orderDate.getTime() + ev.offset * 86400000)]);
          }
        }
      }
    }
    console.log(`   → ${allOrderIds.length} orders (${approvedOrderIds.length} approved)`);

    // ---- 14. Stock alerts ----
    console.log('🔔 Seeding stock alerts…');
    const { rows: lowStockProds } = await pool.query(
      `SELECT id, stock_qty, reorder_level FROM products WHERE stock_qty <= reorder_level AND status = 'ACTIVE' LIMIT 20`
    );
    for (const p of lowStockProds) {
      const alertType = p.stock_qty === 0 ? 'OUT_OF_STOCK' :
                        p.stock_qty <= p.reorder_level ? 'LOW_STOCK' : 'REORDER';
      await pool.query(`
        INSERT INTO stock_alerts (product_id, alert_type, threshold_value, status)
        VALUES ($1,$2,$3,'OPEN')
      `, [p.id, alertType, p.reorder_level]);
    }
    console.log(`   → ${lowStockProds.length} stock alerts`);

    // ---- 15. CMS blocks ----
    console.log('📝 Seeding CMS blocks…');
    await pool.query(`
      INSERT INTO cms_blocks (key, type, content, is_published, updated_by)
      VALUES
        ('home_hero', 'HERO', '{"heading":"Welcome to Orchids","subheading":"Premium Wholesale Orchids from Sri Lanka","cta_text":"Browse Catalogue","cta_url":"/products","background_image":"/assets/hero-orchids.jpg"}', true, $1),
        ('announcement_bar', 'BANNER', '{"text":"🎉 Free delivery on orders over LKR 100,000","enabled":true,"bg_color":"#2d6a4f","text_color":"#ffffff"}', true, $1)
      ON CONFLICT (key) DO UPDATE
        SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `, [staffUsers['ADMIN'].id]);
    console.log('   → 2 CMS blocks');

    // ---- 16. Settings already seeded in 0008 migration ----
    console.log('⚙️  Settings seeded via 0008 migration.');

    // ---- Summary ----
    console.log('\n========================================');
    console.log('🎉 Seed complete!');
    console.log('========================================');
    console.log(`   Buyer tiers:    ${Object.keys(tiers).length}`);
    console.log(`   Staff users:    ${Object.keys(staffUsers).length}`);
    console.log(`   Suppliers:      ${supplierIds.length}`);
    console.log(`   Categories:     ${Object.keys(categoryIds).length}`);
    console.log(`   Products:       ${allProductIds.length}`);
    console.log(`   Trade buyers:   ${tradeBuyerUsers.length}`);
    console.log(`   Orders:         ${allOrderIds.length}`);
    console.log(`   Stock alerts:   ${lowStockProds.length}`);
    console.log('========================================\n');

  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
