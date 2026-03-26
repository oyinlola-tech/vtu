import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = express.Router();

router.get('/overview', requireAdmin, requirePermission('finance:read'), async (req, res) => {
  const [[users]] = await pool.query('SELECT COUNT(*) as total FROM users');
  const [[volume]] = await pool.query('SELECT SUM(total) as total FROM transactions WHERE status = "success"');
  const [[revenue]] = await pool.query('SELECT SUM(fee) as total FROM transactions WHERE status = "success"');
  const [[credits]] = await pool.query(
    'SELECT SUM(total) as total FROM transactions WHERE status = "success" AND type IN ("receive")'
  );
  const [[debits]] = await pool.query(
    'SELECT SUM(total) as total FROM transactions WHERE status = "success" AND type IN ("send","bill","topup")'
  );
  const [[balances]] = await pool.query('SELECT SUM(balance) as total FROM wallets');

  return res.json({
    users: users.total,
    volume: Number(volume.total || 0),
    revenue: Number(revenue.total || 0),
    credits: Number(credits.total || 0),
    debits: Number(debits.total || 0),
    walletBalance: Number(balances.total || 0),
  });
});

router.get('/balances', requireAdmin, requirePermission('finance:read'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 200);
  const offset = Number(req.query.offset || 0);
  const [rows] = await pool.query(
    `SELECT u.full_name, u.email, w.balance, w.currency, w.updated_at
     FROM wallets w
     JOIN users u ON u.id = w.user_id
     ORDER BY w.balance DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return res.json(rows);
});

export default router;
