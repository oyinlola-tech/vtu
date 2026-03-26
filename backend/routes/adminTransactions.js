import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = express.Router();

router.get('/', requireAdmin, requirePermission('transactions:read'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.id, u.full_name, t.type, t.amount, t.fee, t.total, t.status, t.reference, t.created_at
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC
     LIMIT 200`
  );
  return res.json(rows);
});

router.get('/metrics', requireAdmin, requirePermission('transactions:read'), async (req, res) => {
  const [[users]] = await pool.query('SELECT COUNT(*) as total FROM users');
  const [[tx]] = await pool.query('SELECT COUNT(*) as total FROM transactions');
  const [[volume]] = await pool.query('SELECT SUM(total) as total FROM transactions WHERE status = \"success\"');
  return res.json({
    users: users.total,
    transactions: tx.total,
    volume: Number(volume.total || 0),
  });
});

export default router;
