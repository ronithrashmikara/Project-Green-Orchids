const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const env = require('./env');

const templatesDir = path.resolve(__dirname, '../templates');

// Cache compiled templates
const templateCache = new Map();

function loadTemplate(name) {
  if (!templateCache.has(name)) {
    const filePath = path.join(templatesDir, `${name}.hbs`);
    if (!fs.existsSync(filePath)) {
      // Fallback: use plain text
      templateCache.set(name, null);
      return null;
    }
    const source = fs.readFileSync(filePath, 'utf-8');
    const compiled = Handlebars.compile(source);
    templateCache.set(name, compiled);
  }
  return templateCache.get(name);
}

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date) => {
  return new Date(date).toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' });
});

Handlebars.registerHelper('formatMoney', (amount) => {
  return `Rs. ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
});

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (env.isProd) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } else {
    // Dev: use console transport
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('📧 [DEV MAIL]');
        console.log(`   To: ${mailOptions.to}`);
        console.log(`   Subject: ${mailOptions.subject}`);
        console.log(`   HTML: ${(mailOptions.html || '').substring(0, 200)}...`);
        return { messageId: `dev-${Date.now()}` };
      },
    };
  }

  return transporter;
}

/**
 * Render a template with data
 */
function renderTemplate(name, data) {
  const template = loadTemplate(name);
  if (!template) {
    // Plain text fallback
    return `<h2>${name.replace(/_/g, ' ')}</h2><pre>${JSON.stringify(data, null, 2)}</pre>`;
  }
  return template(data);
}

/**
 * Send an email
 */
async function sendMail({ to, subject, template, data, html }) {
  const bodyHtml = html || renderTemplate(template, data);

  const mailOptions = {
    from: `"K ORCHIDS" <${env.EMAIL_FROM}>`,
    to,
    subject,
    html: bodyHtml,
  };

  const transport = getTransporter();
  const result = await transport.sendMail(mailOptions);
  return result;
}

module.exports = { sendMail, renderTemplate };
