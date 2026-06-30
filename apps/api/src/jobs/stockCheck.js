const { query } = require('../config/db');

async function stockCheck() {
  console.log('📦 Running stock check...');
  try {
    // Find products below reorder level
    const lowStock = await query(
      `SELECT id, name, stock_qty, reorder_level FROM products
       WHERE is_active = true AND stock_qty <= reorder_level`
    );

    let alertsCreated = 0;
    for (const product of lowStock.rows) {
      // Dedup: don't create if there's already an OPEN alert for this product
      const existing = await query(
        `SELECT id FROM stock_alerts WHERE product_id = $1 AND alert_type = 'LOW_STOCK' AND status = 'OPEN'`,
        [product.id]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO stock_alerts (product_id, alert_type, message, status)
           VALUES ($1, 'LOW_STOCK', $2, 'OPEN')`,
          [product.id, `${product.name} is below reorder level (${product.stock_qty}/${product.reorder_level})`]
        );
        alertsCreated++;
      }
    }

    if (alertsCreated > 0) {
      console.log(`✅ Created ${alertsCreated} stock alerts`);

      // Send low stock digest to admins
      try {
        const { sendMail } = require('../config/mailer');
        const admins = await query("SELECT email FROM users WHERE role_id IN (SELECT id FROM roles WHERE name = 'ADMIN') AND status = 'ACTIVE'");

        const productsList = lowStock.rows.map(p => ({
          name: p.name, stockQty: p.stock_qty, reorderLevel: p.reorder_level,
        }));

        for (const admin of admins.rows) {
          await sendMail({
            to: admin.email,
            subject: 'Low Stock Alert - ORCHIDS',
            template: 'low_stock_digest',
            data: { products: productsList },
          });
        }
      } catch (mailErr) {
        console.error('Failed to send stock digest:', mailErr.message);
      }
    }
  } catch (err) {
    console.error('Stock check error:', err.message);
  }
}

module.exports = stockCheck;
