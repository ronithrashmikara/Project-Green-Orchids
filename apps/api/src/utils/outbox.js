// Transactional-outbox enqueue helper (Finding 22 / D2.1).
// Writes a notifications_outbox row inside the SAME transaction as the business
// change, so "if the order commits, the email intent commits". The outboxDispatch
// cron job renders and delivers it with exponential backoff — SMTP latency/failure
// can never roll back an order, and emails are never silently lost.
async function enqueueEmail(client, { recipientEmail, recipientUserId = null, template, payload = {} }) {
  if (!client) throw new Error('enqueueEmail must run inside a transaction (pass the tx client)');
  await client.query(
    `INSERT INTO notifications_outbox (recipient_email, recipient_user_id, template, payload, status, next_attempt_at)
     VALUES ($1,$2,$3,$4,'PENDING', NOW())`,
    [recipientEmail, recipientUserId, template, JSON.stringify(payload)]
  );
}

module.exports = { enqueueEmail };
