const { query, tx } = require('../config/db');
const { sendMail } = require('../config/mailer');

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;

async function dispatchOutbox() {
  console.log('📧 Running outbox dispatch...');
  try {
    const pending = await query(
      `SELECT id, recipient_email, template, payload, attempts
       FROM notifications_outbox
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE]
    );

    for (const item of pending.rows) {
      try {
        await sendMail({
          to: item.recipient_email,
          subject: `ORCHIDS: ${item.template}`,
          template: item.template,
          data: item.payload || {},
        });

        await query('UPDATE notifications_outbox SET status = $1, sent_at = NOW() WHERE id = $2', ['SENT', item.id]);
      } catch (err) {
        console.error(`Failed to send email ${item.id}:`, err.message);
        const newAttempts = (item.attempts || 0) + 1;
        const delay = Math.min(Math.pow(2, newAttempts) * 60, 3600); // Exponential backoff up to 1 hour

        if (newAttempts >= MAX_ATTEMPTS) {
          await query(
            'UPDATE notifications_outbox SET status = $1, last_error = $2, attempts = $3, next_attempt_at = NULL WHERE id = $4',
            ['FAILED', err.message, newAttempts, item.id]
          );
        } else {
          await query(
            'UPDATE notifications_outbox SET status = $1, last_error = $2, attempts = $3, next_attempt_at = NOW() + INTERVAL \'1 second\' * $5 WHERE id = $4',
            ['FAILED', err.message, newAttempts, item.id, delay]
          );
        }
      }
    }

    if (pending.rows.length > 0) {
      console.log(`✅ Dispatched ${pending.rows.length} emails`);
    }
  } catch (err) {
    console.error('Outbox dispatch error:', err.message);
  }
}

module.exports = dispatchOutbox;
