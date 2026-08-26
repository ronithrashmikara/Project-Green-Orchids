const { query } = require('../config/db');

// Invoice aging & dunning (Audit F5). The previous implementation targeted a
// non-existent 'ISSUED' status, joined invoices.buyer_id (a trade_accounts UUID)
// to users.id, read an invoice_number column that is actually invoice_no, and
// referenced payments.status which does not exist — so no invoice ever went
// overdue, no reminder ever shipped, and the reliability rollup threw on every run.
//
// Reminders now enqueue into notifications_outbox (durable + retried by
// outboxDispatch) instead of best-effort direct sends.

const BUYER_JOIN = `
  JOIN trade_accounts ta ON ta.id = i.buyer_id
  JOIN users u ON u.id = ta.user_id`;

async function invoiceAging() {
  console.log('💰 Running invoice aging...');
  try {
    // 1. Mark overdue: PENDING/PARTIALLY_PAID past due with money outstanding.
    const overdueResult = await query(
      `UPDATE invoices SET status = 'OVERDUE', updated_at = NOW()
       WHERE status IN ('PENDING', 'PARTIALLY_PAID') AND due_date < CURRENT_DATE AND balance_due > 0
       RETURNING id, invoice_no, buyer_id, due_date, balance_due, total_amount`,
    );
    console.log(`Marked ${overdueResult.rows.length} invoices as overdue`);

    // 2. Pre-due reminders: T-3 days.
    const preDue = await query(
      `SELECT i.invoice_no, i.balance_due, i.due_date, u.email, u.id AS user_id, ta.business_name
       FROM invoices i ${BUYER_JOIN}
       WHERE i.status IN ('PENDING', 'PARTIALLY_PAID') AND i.balance_due > 0
         AND i.due_date = (CURRENT_DATE + INTERVAL '3 days')::date`,
    );
    for (const inv of preDue.rows) {
      await query(
        `INSERT INTO notifications_outbox (recipient_email, recipient_user_id, template, payload, status, next_attempt_at)
         VALUES ($1, $2, 'payment_reminder', $3, 'PENDING', NOW())`,
        [inv.email, inv.user_id, JSON.stringify({
          name: inv.business_name || inv.email,
          invoiceNumber: inv.invoice_no,
          dueDate: inv.due_date,
          amountDue: Number(inv.balance_due).toFixed(2),
          daysUntilDue: 3,
          paymentUrl: '',
        })],
      );
    }

    // 3. Overdue reminders: T+1 day and weekly thereafter (Mondays).
    const overdue = await query(
      `SELECT i.invoice_no, i.balance_due, i.due_date, u.email, u.id AS user_id, ta.business_name
       FROM invoices i ${BUYER_JOIN}
       WHERE i.status = 'OVERDUE' AND i.balance_due > 0
         AND (i.due_date = (CURRENT_DATE - INTERVAL '1 day')::date
              OR EXTRACT(DOW FROM CURRENT_DATE) = 1) -- Weekly nudge on Mondays`,
    );
    for (const inv of overdue.rows) {
      const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
      await query(
        `INSERT INTO notifications_outbox (recipient_email, recipient_user_id, template, payload, status, next_attempt_at)
         VALUES ($1, $2, 'invoice_overdue', $3, 'PENDING', NOW())`,
        [inv.email, inv.user_id, JSON.stringify({
          name: inv.business_name || inv.email,
          invoiceNumber: inv.invoice_no,
          amountDue: Number(inv.balance_due).toFixed(2),
          daysOverdue,
          paymentUrl: '',
        })],
      );
    }
    console.log(`Queued ${preDue.rows.length} pre-due and ${overdue.rows.length} overdue reminders`);

    // 4. Reliability score rollup per trade account. The real column is
    // payment_reliability_score NUMERIC(3,2) on a 0-5 scale (Audit P0-4: the old
    // job referenced a nonexistent reliability_score and a nonexistent p.status).
    // paid_late = any payment received after the invoice due date.
    await query(`
      UPDATE trade_accounts ta SET
        payment_reliability_score = sub.score,
        updated_at = NOW()
      FROM (
        SELECT i.buyer_id,
          ROUND(LEAST(5::numeric, GREATEST(0::numeric,
            CASE
              WHEN SUM(i.total_amount) > 0 THEN
                5 * (SUM(i.total_amount) - SUM(CASE WHEN late.is_late THEN i.total_amount ELSE 0 END))
                  / SUM(i.total_amount)
              ELSE 5
            END)), 2) AS score
        FROM invoices i
        LEFT JOIN LATERAL (
          SELECT MAX(p.received_at) > i.due_date AS is_late
          FROM payments p WHERE p.invoice_id = i.id
        ) late ON true
        WHERE i.buyer_id IS NOT NULL AND i.status IN ('PAID', 'PARTIALLY_PAID', 'OVERDUE')
        GROUP BY i.buyer_id
      ) sub
      WHERE ta.id = sub.buyer_id`,
    );
    console.log('✅ Invoice aging complete');
  } catch (err) {
    console.error('Invoice aging error:', err.message);
  }
}

module.exports = invoiceAging;
