const { query } = require('../config/db');
const { sendMail } = require('../config/mailer');

async function quoteExpiry() {
  console.log('📋 Running quote expiry check...');
  try {
    // Send 24h warnings
    const warningRfqs = await query(
      `SELECT r.*, u.email, u.name FROM rfqs r JOIN users u ON u.id = r.buyer_id
       WHERE r.status = 'QUOTED' AND r.quote_expiry IS NOT NULL
       AND r.quote_expiry BETWEEN NOW() + INTERVAL '24 hours' AND NOW() + INTERVAL '25 hours'`
    );

    for (const rfq of warningRfqs.rows) {
      try {
        await sendMail({
          to: rfq.email, subject: 'RFQ Quote Expiring Soon - Orchids', template: 'rfq_quoted',
          data: { name: rfq.name, rfqNumber: rfq.rfq_number, totalAmount: '', quoteExpiry: rfq.quote_expiry, rfqUrl: '' },
        });
      } catch (_) {}
    }

    // Mark expired
    const result = await query(
      `UPDATE rfqs SET status = 'EXPIRED', updated_at = NOW()
       WHERE status = 'QUOTED' AND quote_expiry IS NOT NULL AND quote_expiry < NOW()
       RETURNING id, rfq_number`
    );

    if (result.rows.length > 0) {
      console.log(`Marked ${result.rows.length} RFQs as expired`);
    }
  } catch (err) {
    console.error('Quote expiry error:', err.message);
  }
}

module.exports = quoteExpiry;
