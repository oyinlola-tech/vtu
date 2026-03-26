import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { sendReceiptEmail } from '../utils/email.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.get('/balance', requireUser, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT balance, currency FROM wallets WHERE user_id = ?',
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'Wallet not found' });
  return res.json(rows[0]);
});

router.post('/send', requireUser, async (req, res) => {
  const { to, amount } = req.body || {};
  const numericAmount = Number(amount);
  if (!to || !numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const [targets] = await pool.query(
    'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
    [to, to]
  );
  if (!targets.length) return res.status(404).json({ error: 'Recipient not found' });
  const recipientId = targets[0].id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [walletRows] = await conn.query(
      'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [req.user.sub]
    );
    if (!walletRows.length) throw new Error('Wallet missing');
    if (Number(walletRows[0].balance) < numericAmount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await conn.query('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [
      numericAmount,
      req.user.sub,
    ]);
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [
      numericAmount,
      recipientId,
    ]);

    const reference = `TX-${nanoid(10)}`;
    await conn.query(
      'INSERT INTO transactions (id, user_id, type, amount, fee, total, status, reference, metadata) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.sub,
        'send',
        numericAmount,
        0,
        numericAmount,
        'success',
        reference,
        JSON.stringify({ to }),
      ]
    );
    await conn.query(
      'INSERT INTO transactions (id, user_id, type, amount, fee, total, status, reference, metadata) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        recipientId,
        'receive',
        numericAmount,
        0,
        numericAmount,
        'success',
        reference,
        JSON.stringify({ from: req.user.sub }),
      ]
    );
    await conn.commit();
    const [[sender]] = await pool.query(
      'SELECT full_name, email FROM users WHERE id = ?',
      [req.user.sub]
    );
    const [[recipient]] = await pool.query(
      'SELECT full_name, email FROM users WHERE id = ?',
      [recipientId]
    );
    sendReceiptEmail({
      to: sender.email,
      name: sender.full_name,
      title: 'Transfer Successful',
      details: [
        `Amount: ₦${numericAmount.toFixed(2)}`,
        `Recipient: ${recipient.full_name}`,
        `Reference: ${reference}`,
      ],
    }).catch(console.error);
    sendReceiptEmail({
      to: recipient.email,
      name: recipient.full_name,
      title: 'Money Received',
      details: [
        `Amount: ₦${numericAmount.toFixed(2)}`,
        `Sender: ${sender.full_name}`,
        `Reference: ${reference}`,
      ],
    }).catch(console.error);
    logAudit({
      actorType: 'user',
      actorId: req.user.sub,
      action: 'wallet.transfer',
      entityType: 'transaction',
      entityId: reference,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { to },
    }).catch(console.error);
    return res.json({ message: 'Transfer completed', reference });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: 'Transfer failed' });
  } finally {
    conn.release();
  }
});

router.post('/receive', requireUser, async (req, res) => {
  const { amount, note } = req.body || {};
  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const reference = `REQ-${nanoid(10)}`;
  await pool.query(
    'INSERT INTO transactions (id, user_id, type, amount, fee, total, status, reference, metadata) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      req.user.sub,
      'request',
      numericAmount,
      0,
      numericAmount,
      'pending',
      reference,
      JSON.stringify({ note }),
    ]
  );
  return res.json({ message: 'Money request created', reference });
});

export default router;
