import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireUser, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT name, code FROM banks WHERE active = 1 ORDER BY name'
  );
  return res.json(rows);
});

router.post('/resolve', requireUser, async (req, res) => {
  const { accountNumber, bankCode } = req.body || {};
  if (!accountNumber || String(accountNumber).length < 8) {
    return res.status(400).json({ error: 'Account number required' });
  }

  if (bankCode) {
    const [[bank]] = await pool.query('SELECT name FROM banks WHERE code = ? AND active = 1', [
      bankCode,
    ]);
    if (!bank) return res.status(400).json({ error: 'Invalid bank selected' });
    const [[match]] = await pool.query(
      `SELECT u.full_name, r.account_number, r.bank_name, r.bank_code
       FROM reserved_accounts r
       JOIN users u ON u.id = r.user_id
       WHERE r.account_number = ? LIMIT 1`,
      [accountNumber]
    );
    if (match) {
      return res.json({
        found: true,
        accountName: match.full_name,
        bankName: match.bank_name || bank.name,
        bankCode: match.bank_code || bankCode,
      });
    }
    return res.json({ found: false, bankCode, bankName: bank.name });
  }

  const [[match]] = await pool.query(
    `SELECT u.full_name, r.account_number, r.bank_name, r.bank_code
     FROM reserved_accounts r
     JOIN users u ON u.id = r.user_id
     WHERE r.account_number = ? LIMIT 1`,
    [accountNumber]
  );
  if (match) {
    return res.json({
      found: true,
      accountName: match.full_name,
      bankName: match.bank_name,
      bankCode: match.bank_code,
    });
  }
  const [banks] = await pool.query(
    'SELECT name, code FROM banks WHERE active = 1 ORDER BY name'
  );
  return res.json({ found: false, banks });
});

export default router;
