const { query } = require('../config/db');
const { sendMail } = require('../config/mailer');

async function invoiceAging() {
  console.log('💰 Running invoice aging...');
  try {
    // Mark overdue invoices
    const overdueResult = await query(
      `UPDATE invoices SET status = 'OVERDUE', updated_at = NOW()
       WHERE status IN ('ISSUED', 'PARTIALLY_PAID') AND due_date < NOW() AND balance_due > 0
       RETURNING id, invoice_number, buyer_id, due_date, balance_due, total_amount`
    );
    console.log(`Marked ${overdueResult.rows.length} invoices as overdue`);

    // Send reminders
    // Pre-due: T-3 days
    const preDue = await query(
      `SELECT i.*, u.email, u.name FROM invoices i
       JOIN users u ON u.id = i.buyer_id
       WHERE i.status IN ('ISSUED', 'PARTIALLY_PAID') AND i.balance_due > 0
       AND i.due_date = (CURRENT_DATE + INTERVAL '3 days')::date`
    );

    for (const inv of preDue.rows) {
      try {
        await sendMail({
          to: inv.email, subject: 'Payment Reminder - Orchids', template: 'payment_reminder',
          data: { name: inv.name, invoiceNumber: inv.invoice_number, dueDate: inv.due_date, amountDue: Number(inv.balance_due).toFixed(2), daysUntilDue: 3, paymentUrl: '' },
        });
      } catch (_) {}
    }

    // Overdue: T+1 and weekly
    const overdue = await query(
      `SELECT i.*, u.email, u.name FROM invoices i JOIN users u ON u.id = i.buyer_id
       WHERE i.status = 'OVERDUE' AND i.balance_due > 0
       AND (i.due_date = (CURRENT_DATE - INTERVAL '1 day')::date
            OR EXTRACT(DOW FROM CURRENT_DATE) = 1) -- Weekly on Mondays`
    );

    for (const inv of overdue.rows) {
      try {
        const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
        await sendMail({
          to: inv.email, subject: 'Invoice Overdue - Orchids', template: 'invoice_overdue',
          data: { name: inv.name, invoiceNumber: inv.invoice_number, amountDue: Number(inv.balance_due).toFixed(2), daysOverdue, paymentUrl: '' },
        });
      } catch (_) {}
    }

    // Recompute reliability scores (simplified)
    await query(`
      UPDATE trade_accounts ta SET
        reliability_score = CASE
          WHEN total_paid > 0 THEN ROUND((total_paid - total_late)::numeric / total_paid * 100, 2)
          ELSE 100 END,
        updated_at = NOW()
      FROM (
        SELECT i.buyer_id,
          COALESCE(SUM(i.total_amount), 0) as total_paid,
          COALESCE(SUM(CASE WHEN i.status = 'OVERDUE' OR p.paid_late THEN i.total_amount ELSE 0 END), 0) as total_late
        FROM invoices i
        LEFT JOIN LATERAL (
          SELECT CASE WHEN MAX(p.created_at) > i.due_date THEN true ELSE false END as paid_late
          FROM payments p WHERE p.invoice_id = i.id AND p.status = 'COMPLETED'
        ) p ON true
        WHERE i.status IN ('PAID', 'PARTIALLY_PAID', 'OVERDUE')
        GROUP BY i.buyer_id
      ) stats
      WHERE ta.user_id = stats.buyer_id
    `);

    console.log('✅ Invoice aging complete');
  } catch (err) {
    console.error('Invoice aging error:', err.message);
  }
}

module.exports = invoiceAging;
