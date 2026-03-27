import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { initDatabase } from './backend/config/db.js';
import authRoutes from './backend/routes/auth.js';
import adminAuthRoutes from './backend/routes/adminAuth.js';
import userRoutes from './backend/routes/user.js';
import walletRoutes from './backend/routes/wallet.js';
import billsRoutes from './backend/routes/bills.js';
import transactionsRoutes from './backend/routes/transactions.js';
import adminUsersRoutes from './backend/routes/adminUsers.js';
import adminBillsRoutes from './backend/routes/adminBills.js';
import adminTransactionsRoutes from './backend/routes/adminTransactions.js';
import adminManagementRoutes from './backend/routes/adminManagement.js';
import adminAuditRoutes from './backend/routes/adminAudit.js';
import adminFinanceRoutes from './backend/routes/adminFinance.js';
import monnifyWebhookRoutes from './backend/routes/monnifyWebhook.js';
import adminMonnifyRoutes from './backend/routes/adminMonnify.js';
import banksRoutes from './backend/routes/banks.js';
import { refreshBankCache } from './backend/utils/bankCache.js';
import { pool } from './backend/config/db.js';
import { processMonnifyEvent } from './backend/utils/monnifyProcessor.js';
import { authLimiter, adminAuthLimiter, webhookLimiter } from './backend/middleware/rateLimiters.js';
import { csrfMiddleware } from './backend/middleware/csrf.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.disable('x-powered-by');

const isProd = process.env.NODE_ENV === 'production';
let dbReady = false;
let dbCheckedAt = null;
let dbError = null;
if (isProd) {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtAdminSecret = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'dev_secret_change_me') {
    console.error('JWT_SECRET must be set to a strong value in production.');
    process.exit(1);
  }
  if (!jwtAdminSecret || jwtAdminSecret === 'dev_secret_change_me') {
    console.error('JWT_ADMIN_SECRET must be set to a strong value in production.');
    process.exit(1);
  }
}
const trustProxy = Number(process.env.TRUST_PROXY || 0);
if (trustProxy) {
  app.set('trust proxy', trustProxy);
}

const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const extraOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
  : [...defaultOrigins, ...extraOrigins];
const normalizedOrigins = allowedOrigins.filter((o) => o !== '*');

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin and non-browser requests (no Origin header)
    if (!origin) {
      return callback(null, true);
    }

    if (normalizedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 600,
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(cookieParser());
app.use(csrfMiddleware);

// Silence Chrome DevTools probe that can show up as a 404 + CSP warning in console.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// Block direct browser access to /api/* (public surface is /app/*).
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  const secFetchSite = req.headers['sec-fetch-site'];
  const secFetchMode = req.headers['sec-fetch-mode'];
  const internal = req.headers['x-internal-request'] === '1';
  if (internal || (!origin && !secFetchSite && !secFetchMode)) {
    return next();
  }
  return res.status(403).json({ error: 'Direct browser access blocked. Use /app/*.' });
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const pageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PAGES_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
});

const userDir = path.join(__dirname, 'frontend', 'user');
const adminDir = path.join(__dirname, 'frontend', 'admin');

app.use('/', express.static(userDir));
app.use('/admin', express.static(adminDir));

if (!isProd) {
  app.get('/dev-status', (req, res) => {
    res.json({ dbReady, dbCheckedAt, dbError });
  });
}

const userPages = [
  'splash',
  'login',
  'register',
  'dashboard',
  'wallet',
  'send',
  'receive',
  'bills',
  'transactions',
  'kyc',
  'settings',
  'verify-device',
  'forgot-password',
  'reset-password',
  'terms',
  'privacy',
  'support',
  'faq',
];

userPages.forEach((page) => {
  app.get(`/${page}`, pageLimiter, (req, res) => {
    res.sendFile(path.join(userDir, `${page}.html`));
  });
});

app.get('/', pageLimiter, (req, res) => res.redirect('/splash'));
app.get('/admin', pageLimiter, (req, res) => res.redirect('/admin/splash'));

const adminPages = [
  'splash',
  'login',
  'forgot-password',
  'reset-password',
  'dashboard',
  'finance',
  'users',
  'admins',
  'bills',
  'pricing',
  'transactions',
  'settings',
  'audit',
  'monnify',
];

adminPages.forEach((page) => {
  app.get(`/admin/${page}`, pageLimiter, (req, res) => {
    res.sendFile(path.join(adminDir, `${page}.html`));
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/banks', banksRoutes);

app.use('/api/admin/auth', adminAuthLimiter, adminAuthRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/bills', adminBillsRoutes);
app.use('/api/admin/transactions', adminTransactionsRoutes);
app.use('/api/admin/manage', adminManagementRoutes);
app.use('/api/admin/audit', adminAuditRoutes);
app.use('/api/admin/finance', adminFinanceRoutes);
app.use('/api/monnify/webhook', webhookLimiter, monnifyWebhookRoutes);
app.use('/api/admin/monnify', adminMonnifyRoutes);

// Backend-only proxy layer for frontend calls
app.use('/app/api/auth', authLimiter, authRoutes);
app.use('/app/api/user', userRoutes);
app.use('/app/api/wallet', walletRoutes);
app.use('/app/api/bills', billsRoutes);
app.use('/app/api/transactions', transactionsRoutes);
app.use('/app/api/banks', banksRoutes);

app.use('/app/admin/api/auth', adminAuthLimiter, adminAuthRoutes);
app.use('/app/admin/api/users', adminUsersRoutes);
app.use('/app/admin/api/bills', adminBillsRoutes);
app.use('/app/admin/api/transactions', adminTransactionsRoutes);
app.use('/app/admin/api/manage', adminManagementRoutes);
app.use('/app/admin/api/audit', adminAuditRoutes);
app.use('/app/admin/api/finance', adminFinanceRoutes);
app.use('/app/admin/api/monnify', adminMonnifyRoutes);

const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
async function setupSwaggerDocs(appInstance) {
  if (!enableSwagger) return;
  const swaggerPath = path.join(__dirname, 'backend', 'docs', 'swagger-output.json');
  let swaggerDocument = null;

  try {
    const raw = fs.readFileSync(swaggerPath, 'utf-8');
    swaggerDocument = JSON.parse(raw);
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Swagger file missing. Run `npm run swagger` to generate it.');
      return;
    }
    try {
      const { generateSwagger } = await import('./backend/docs/swagger.js');
      await generateSwagger();
      const raw = fs.readFileSync(swaggerPath, 'utf-8');
      swaggerDocument = JSON.parse(raw);
    } catch (genErr) {
      console.warn('Swagger generation failed:', genErr.message);
      return;
    }
  }

  appInstance.use('/api-docs', (req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' https: http: data:; img-src 'self' data: https: http:; script-src 'self' 'unsafe-inline' https: http:; style-src 'self' 'unsafe-inline' https: http:; font-src 'self' data: https: http:; connect-src 'self' https: http:;"
    );
    next();
  });
  appInstance.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, { explorer: true }));
  appInstance.get('/api-docs.json', (req, res) => res.json(swaggerDocument));
}

const swaggerReady = setupSwaggerDocs(app);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS blocked' });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    await initDatabase();
    dbReady = true;
    dbCheckedAt = new Date().toISOString();
    dbError = null;
  } catch (err) {
    dbReady = false;
    dbCheckedAt = new Date().toISOString();
    dbError = err?.message || String(err);
    if (isProd) {
      console.error('Database init failed:', err);
      process.exit(1);
    }
    console.warn('Database init failed (dev mode). Running UI without DB.');
  }

  await swaggerReady;
  app.listen(PORT, () => {
    console.log(`GLY VTU API running on http://localhost:${PORT}`);
  });

  if (!dbReady) return;

  const banksRefreshInterval = Number(process.env.BANKS_REFRESH_INTERVAL_MS || 21600000);
  setInterval(() => {
    refreshBankCache().catch((err) =>
      console.error('Bank cache refresh failed:', err.message)
    );
  }, banksRefreshInterval);
  refreshBankCache().catch((err) =>
    console.error('Bank cache initial refresh failed:', err.message)
  );

  const retryInterval = Number(process.env.MONNIFY_RETRY_INTERVAL_MS || 60000);
  const retryBatch = Number(process.env.MONNIFY_RETRY_BATCH || 20);
  const retryMax = Number(process.env.MONNIFY_RETRY_MAX_ATTEMPTS || 5);
  setInterval(async () => {
    try {
      const [rows] = await pool.query(
        `SELECT payment_reference, raw_payload, attempts
         FROM monnify_events
         WHERE status = 'failed' AND attempts < ?
         ORDER BY updated_at ASC
         LIMIT ?`,
        [retryMax, retryBatch]
      );
      for (const row of rows) {
        if (!row.raw_payload) continue;
        const payload = JSON.parse(row.raw_payload);
        await processMonnifyEvent(payload, { ip: 'system', userAgent: 'retry-job' });
      }
    } catch (err) {
      console.error('Monnify retry job error:', err.message);
    }
  }, retryInterval);
}

startServer();
