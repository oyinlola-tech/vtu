import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();

router.get('/profile', requireUser, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.kyc_level, u.kyc_status, u.kyc_payload,
            r.account_number, r.bank_name, r.account_name
     FROM users u
     LEFT JOIN reserved_accounts r ON r.user_id = u.id
     WHERE u.id = ?`,
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  return res.json(rows[0]);
});

router.put('/profile', requireUser, async (req, res) => {
  const { fullName, phone } = req.body || {};
  if (!fullName || !phone) return res.status(400).json({ error: 'Missing fields' });

  await pool.query('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [
    fullName,
    phone,
    req.user.sub,
  ]);
  return res.json({ message: 'Profile updated' });
});

router.put('/kyc', requireUser, async (req, res) => {
  const { level, payload } = req.body || {};
  if (!level || !payload) return res.status(400).json({ error: 'Missing KYC data' });
  if (![1, 2].includes(Number(level))) return res.status(400).json({ error: 'Invalid level' });

  await pool.query(
    'UPDATE users SET kyc_level = ?, kyc_status = ?, kyc_payload = ? WHERE id = ?',
    [Number(level), 'pending', JSON.stringify(payload), req.user.sub]
  );
  return res.json({ message: 'KYC submitted' });
});

export default router;
