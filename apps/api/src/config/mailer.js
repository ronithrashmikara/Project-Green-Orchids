const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const env = require('./env');

const templatesDir = path.resolve(__dirname, '../templates');
const TEMPLATE_FILES = Object.freeze({
  account_locked: 'account_locked.hbs',
  buyer_approved: 'buyer_approved.hbs',
  buyer_rejected: 'buyer_rejected.hbs',
  buyer_suspended: 'buyer_suspended.hbs',
  delivery_confirmed: 'delivery_confirmed.hbs',
  dispatch_notification: 'dispatch_notification.hbs',
  invoice_overdue: 'invoice_overdue.hbs',
  low_stock_digest: 'low_stock_digest.hbs',
  new_device_login: 'new_device_login.hbs',
  order_approved: 'order_approved.hbs',
  order_cancelled: 'order_cancelled.hbs',
  order_rejected: 'order_rejected.hbs',
  order_submitted: 'order_submitted.hbs',
  password_changed: 'password_changed.hbs',
  payment_received: 'payment_received.hbs',
  payment_reminder: 'payment_reminder.hbs',
  price_approval_needed: 'price_approval_needed.hbs',
  reset_password: 'reset_password.hbs',
  rfq_declined: 'rfq_declined.hbs',
  rfq_quoted: 'rfq_quoted.hbs',
  rfq_received: 'rfq_received.hbs',
  rma_decision: 'rma_decision.hbs',
  rma_received: 'rma_received.hbs',
  rma_resolved: 'rma_resolved.hbs',
  verify_email: 'verify_email.hbs',
});

const templateCache = new Map();

function loadTemplate(name) {
  const filename = TEMPLATE_FILES[name];
  if (!filename) throw new Error(`Unsupported email template: ${String(name)}`);
  if (!templateCache.has(name)) {
    const source = fs.readFileSync(path.resolve(templatesDir, filename), 'utf8');
    templateCache.set(name, Handlebars.compile(source));
  }
  return templateCache.get(name);
}

Handlebars.registerHelper('formatDate', (date) =>
  new Date(date).toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' }));
Handlebars.registerHelper('formatMoney', (amount) =>
  `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`);

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT !== 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    return transporter;
  }
  if (env.isProd) throw new Error('SMTP credentials are required in production');
  // JSON transport preserves local/test behavior without logging recipient or
  // message content and without pretending a message was externally delivered.
  transporter = nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

function renderTemplate(name, data = {}) {
  return loadTemplate(name)(data);
}

function safeHeader(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized || /[\r\n]/.test(normalized)) throw new Error(`Invalid email ${field}`);
  return normalized;
}

async function sendMail({ to, subject, template, data }) {
  const bodyHtml = renderTemplate(template, data);
  return getTransporter().sendMail({
    from: safeHeader(`Orchids <${env.EMAIL_FROM}>`, 'sender'),
    to: safeHeader(to, 'recipient'),
    subject: safeHeader(subject, 'subject').slice(0, 200),
    html: bodyHtml,
  });
}

module.exports = { sendMail, renderTemplate };
