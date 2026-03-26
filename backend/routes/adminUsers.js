import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, phone, kyc_level, kyc_status, created_at FROM users ORDER BY created_at DESC LIMIT 200'
  );
  return res.json(rows);
});

router.put('/:id/kyc', requireAdmin, async (req, res) => {
  const { status, level } = req.body || {};
  if (!['verified', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await pool.query('UPDATE users SET kyc_status = ?, kyc_level = ? WHERE id = ?', [
    status,
    Number(level || 1),
    req.params.id,
  ]);
  return res.json({ message: 'KYC updated' });
});

export default router;
