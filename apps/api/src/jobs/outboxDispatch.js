const { query, tx } = require('../config/db');
const { sendMail } = require('../config/mailer');

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;

// Human-readable subjects (Audit P2-12): the template key is an internal
// identifier, not something a recipient should see in their inbox.
const SUBJECTS = {
  account_locked: 'Your account has been locked',
  buyer_approved: 'Your trade account was approved',
  buyer_rejected: 'Your trade account application',
  buyer_suspended: 'Your trade account was suspended',
  delivery_confirmed: 'Delivery confirmed — thank you',
  dispatch_notification: 'Your order is on its way',
  invoice_overdue: 'Invoice overdue notice',
  low_stock_digest: 'Low stock digest',
  new_device_login: 'New sign-in to your account',
  order_approved: 'Your order was approved',
  order_cancelled: 'Your order was cancelled',
  order_rejected: 'Your order was not approved',
  order_submitted: 'We received your order',
  password_changed: 'Your password was changed',
  payment_received: 'Payment received — thank you',
  payment_reminder: 'Payment reminder',
  price_approval_needed: 'Price change approval needed',
  reset_password: 'Reset your password',
  rfq_declined: 'Your quote request was declined',
  rfq_quoted: 'Your quote request has pricing',
  rfq_received: 'We received your quote request',
  rma_decision: 'Update on your return request',
  rma_received: 'Return items received',
  rma_resolved: 'Your return request is resolved',
  verify_email: 'Verify your email address',
};

async function dispatchOutbox() {
  console.log('📧 Running outbox dispatch...');
  try {
    // Atomically claim a batch (Audit F4): SELECT ... FOR UPDATE SKIP LOCKED
    // inside a transaction marks rows SENDING so a second worker (or a second
    // instance) skips them, and the locks actually hold until the claim commits.
    const claimed = await tx(async (client) => {
      const { rows } = await client.query(
        `SELECT id, recipient_email, template, payload, attempts
         FROM notifications_outbox
         WHERE status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [BATCH_SIZE],
      );
      if (rows.length) {
        await client.query(
          `UPDATE notifications_outbox SET status = 'SENDING' WHERE id = ANY($1::bigint[])`,
          [rows.map(r => r.id)],
        );
      }
      return rows;
    });

    for (const item of claimed) {
      try {
        await sendMail({
          to: item.recipient_email,
          subject: SUBJECTS[item.template] || `Orchids update (${item.template})`,
          template: item.template,
          data: item.payload || {},
        });
        await query('UPDATE notifications_outbox SET status = $1, sent_at = NOW(), attempts = attempts + 1 WHERE id = $2', ['SENT', item.id]);
      } catch (err) {
        console.error(`Failed to send email ${item.id}:`, err.message);
        const newAttempts = (item.attempts || 0) + 1;
        // Transient failure: back to PENDING with exponential backoff so the
        // next run retries it. Only MAX_ATTEMPTS failures mark it terminally FAILED.
        if (newAttempts >= MAX_ATTEMPTS) {
          await query(
            'UPDATE notifications_outbox SET status = $1, last_error = $2, attempts = $3, next_attempt_at = NULL WHERE id = $4',
            ['FAILED', err.message, newAttempts, item.id],
          );
        } else {
          const delaySec = Math.min(Math.pow(2, newAttempts) * 60, 3600);
          await query(
            `UPDATE notifications_outbox SET status = 'PENDING', last_error = $1, attempts = $2,
             next_attempt_at = NOW() + INTERVAL '1 second' * $3 WHERE id = $4`,
            [err.message, newAttempts, delaySec, item.id],
          );
        }
      }
    }

    // Safety net: rows stuck SENDING from a crashed previous run go back to the
    // queue (no updated_at column exists; created_at + a generous window is the
    // reliable signal).
    await query(
      `UPDATE notifications_outbox SET status = 'PENDING', next_attempt_at = NOW()
       WHERE status = 'SENDING' AND created_at < NOW() - INTERVAL '30 minutes'`,
    );

    if (claimed.length > 0) {
      console.log(`✅ Processed ${claimed.length} queued emails`);
    }
  } catch (err) {
    console.error('Outbox dispatch error:', err.message);
  }
}

module.exports = dispatchOutbox;
