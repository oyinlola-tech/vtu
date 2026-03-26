import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { createReservedAccount } from '../utils/monnify.js';
import { sendReservedAccountEmail } from '../utils/email.js';

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
  if (Number(level) === 1) {
    if (!payload.bvn && !payload.nin) {
      return res.status(400).json({ error: 'BVN or NIN is required for Level 1' });
    }
  }

  await pool.query(
    'UPDATE users SET kyc_level = ?, kyc_status = ?, kyc_payload = ? WHERE id = ?',
    [Number(level), 'pending', JSON.stringify(payload), req.user.sub]
  );

  if (Number(level) === 1) {
    const bvn = payload.bvn;
    const nin = payload.nin;
    if (bvn || nin) {
      const [existing] = await pool.query(
        'SELECT id FROM reserved_accounts WHERE user_id = ? LIMIT 1',
        [req.user.sub]
      );
      if (!existing.length) {
        const [[user]] = await pool.query(
          'SELECT full_name, email FROM users WHERE id = ?',
          [req.user.sub]
        );
        try {
          const accountReference = `GLY-${req.user.sub}`;
          const reserved = await createReservedAccount({
            accountReference,
            accountName: user.full_name,
            customerName: user.full_name,
            customerEmail: user.email,
            bvn,
            nin,
          });
          const account = reserved?.accounts?.[0] || {};
          await pool.query(
            `INSERT INTO reserved_accounts
             (id, user_id, provider, account_reference, reservation_reference, account_name, account_number, bank_name, bank_code, status, raw_response)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.user.sub,
              'monnify',
              accountReference,
              reserved?.reservationReference || null,
              reserved?.accountName || user.full_name,
              account.accountNumber || reserved?.accountNumber || '',
              account.bankName || reserved?.bankName || '',
              account.bankCode || null,
              reserved?.status || 'ACTIVE',
              JSON.stringify(reserved || {}),
            ]
          );
          if (user?.email) {
            sendReservedAccountEmail({
              to: user.email,
              name: user.full_name,
              accountNumber: account.accountNumber || reserved?.accountNumber,
              bankName: account.bankName || reserved?.bankName,
            }).catch(console.error);
          }
        } catch (err) {
          // Keep KYC submission; reserved account can be retried later.
        }
      }
    }
  }
  return res.json({ message: 'KYC submitted' });
});

export default router;
