const { query } = require('../config/db');

// Quote expiry sweep (Audit F6 / P1-6). The previous version joined
// rfqs.buyer_id (trade_accounts UUID) to users.id — matching nothing — read an
// r.rfq_number column that is actually rfq_no, and used a 1-hour warning window
// that a once-daily cron could never hit. The warning now covers the whole next
// 24h, so every expiring quote gets exactly one daily warning.
async function quoteExpiry() {
  console.log('📋 Running quote expiry check...');
  try {
    // Warnings: quotes expiring within the next 24 hours.
    const warningRfqs = await query(
      `SELECT r.id, r.rfq_no, r.quote_expiry, u.email, u.id AS user_id,
              COALESCE(NULLIF(ta.business_name, ''), u.name) AS display_name
       FROM rfqs r
       JOIN trade_accounts ta ON ta.id = r.buyer_id
       JOIN users u ON u.id = ta.user_id
       WHERE r.status = 'QUOTED' AND r.quote_expiry IS NOT NULL
         AND r.quote_expiry > NOW()
         AND r.quote_expiry <= NOW() + INTERVAL '24 hours'`,
    );

    for (const rfq of warningRfqs.rows) {
      try {
        await query(
          `INSERT INTO notifications_outbox (recipient_email, recipient_user_id, template, payload, status, next_attempt_at)
           VALUES ($1, $2, 'rfq_quoted', $3, 'PENDING', NOW())`,
          [rfq.email, rfq.user_id, JSON.stringify({
            name: rfq.display_name || rfq.email,
            rfqNumber: rfq.rfq_no,
            totalAmount: '',
            quoteExpiry: rfq.quote_expiry,
            rfqUrl: '',
            expiringSoon: true,
          })],
        );
      } catch (_) {}
    }
    if (warningRfqs.rows.length > 0) {
      console.log(`Queued ${warningRfqs.rows.length} expiry warnings`);
    }

    // Mark expired.
    const result = await query(
      `UPDATE rfqs SET status = 'EXPIRED', updated_at = NOW()
       WHERE status = 'QUOTED' AND quote_expiry IS NOT NULL AND quote_expiry < NOW()
       RETURNING id, rfq_no`,
    );

    if (result.rows.length > 0) {
      console.log(`Marked ${result.rows.length} RFQs as expired`);
    }
  } catch (err) {
    console.error('Quote expiry error:', err.message);
  }
}

module.exports = quoteExpiry;
