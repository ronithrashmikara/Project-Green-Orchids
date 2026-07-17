// Load env first
const env = require('./config/env');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const requestId = require('./middleware/request_id');
const { globalLimiter } = require('./middleware/rateLimit');
const { auditMiddleware } = require('./middleware/audit');
const { errorHandler, notFoundHandler, setupGlobalHandlers } = require('./middleware/errors');
const { registerJobs } = require('./jobs');
const { UPLOADS_ROOT } = require('./middleware/upload');

// Setup global error handlers
setupGlobalHandlers();

const app = express();

// Trust the first hop (Render's load balancer in prod, the Next.js dev
// rewrite proxy locally) so req.ip / X-Forwarded-For resolve to the real
// client IP instead of the proxy's — required for express-rate-limit to
// key correctly, and required by our own security spec (B8).
app.set('trust proxy', 1);

// ── Middleware Chain ──
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Requested-With'],
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(globalLimiter);
app.use(auditMiddleware);

// ── Health Check ──
app.get('/healthz', async (_req, res) => {
  try {
    const { pool } = require('./config/db');
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

// ── Uploaded file serving (POD photos, etc.) ──
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(UPLOADS_ROOT));

// ── API Routes ──
const api = express.Router();

// Compatibility routes for the shipped Next.js client. These are mounted first
// so specific paths such as /products/catalogue do not get swallowed by
// generic legacy routes like /products/:id.
api.use('/', require('./modules/compat/compat.routes'));

// Mount all route modules at /api/
api.use('/auth', require('./modules/auth/auth.routes'));
api.use('/users', require('./modules/users/users.routes'));
api.use('/buyers', require('./modules/buyers/buyers.routes'));
api.use('/suppliers', require('./modules/suppliers/suppliers.routes'));
api.use('/products', require('./modules/products/products.routes'));
api.use('/pricing', require('./modules/pricing/pricing.routes'));
api.use('/rfqs', require('./modules/rfq/rfq.routes'));
api.use('/cart', require('./modules/cart/cart.routes'));
api.use('/orders', require('./modules/orders/orders.routes'));
api.use('/invoices', require('./modules/invoices/invoices.routes'));
api.use('/payments', require('./modules/payments/payments.routes'));
api.use('/rma', require('./modules/rma/rma.routes'));
api.use('/complaints', require('./modules/complaints/complaints.routes'));
api.use('/sales', require('./modules/sales/sales.routes'));
api.use('/deliveries', require('./modules/delivery/delivery.routes'));
api.use('/inventory', require('./modules/inventory/inventory.routes'));
api.use('/reports', require('./modules/reports/reports.routes'));
api.use('/notifications', require('./modules/notifications/notifications.routes'));
api.use('/cms', require('./modules/cms/cms.routes'));
api.use('/admin/tiers', require('./modules/tiers/tiers.routes'));
api.use('/finance', require('./modules/finance/finance.routes'));
api.use('/admin/security', require('./modules/security/security.routes'));

// Mount /api prefix
app.use('/api', api);

// ── Error Handling ──
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start ──
if (require.main === module) {
  const PORT = env.PORT;

  // Cron jobs are intentionally opt-in for this local build. The interactive
  // app runs all request/response features without the background schedulers.
  if (env.ENABLE_CRON) {
    registerJobs();
  } else {
    console.log('📅 Cron jobs disabled (set ENABLE_CRON=true to enable)');
  }

  app.listen(PORT, () => {
    console.log(`🌿 Project Green API running on port ${PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Health: http://localhost:${PORT}/healthz`);
    console.log(`   API: http://localhost:${PORT}/api`);
  });
}

module.exports = app;
