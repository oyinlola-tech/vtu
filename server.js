import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
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
import { authLimiter, otpLimiter, adminAuthLimiter } from './backend/middleware/rateLimiters.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const userDir = path.join(__dirname, 'frontend', 'user');
const adminDir = path.join(__dirname, 'frontend', 'admin');

app.use('/', express.static(userDir));
app.use('/admin', express.static(adminDir));

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
];

userPages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(userDir, `${page}.html`));
  });
});

app.get('/', (req, res) => res.redirect('/splash'));
app.get('/admin', (req, res) => res.redirect('/admin/splash'));

const adminPages = [
  'splash',
  'login',
  'dashboard',
  'users',
  'bills',
  'pricing',
  'transactions',
  'settings',
];

adminPages.forEach((page) => {
  app.get(`/admin/${page}`, (req, res) => {
    res.sendFile(path.join(adminDir, `${page}.html`));
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/transactions', transactionsRoutes);

app.use('/api/admin/auth', adminAuthLimiter, adminAuthRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/bills', adminBillsRoutes);
app.use('/api/admin/transactions', adminTransactionsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = Number(process.env.PORT || 3000);

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`GLY VTU API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database init failed:', err);
    process.exit(1);
  });
