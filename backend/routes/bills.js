import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { sendReceiptEmail } from '../utils/email.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.get('/categories', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, code, name, description FROM bill_categories WHERE active = 1 ORDER BY name'
  );
  return res.json(rows);
});

router.get('/providers', async (req, res) => {
  const { category } = req.query;
  if (!category) return res.status(400).json({ error: 'Category required' });

  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.code, c.code as category_code
     FROM bill_providers p
     JOIN bill_categories c ON c.id = p.category_id
     WHERE c.code = ? AND p.active = 1`,
    [category]
  );
  return res.json(rows);
});

router.post('/quote', requireUser, async (req, res) => {
  const { providerCode, amount } = req.body || {};
  const numericAmount = Number(amount);
  if (!providerCode || !numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const [rows] = await pool.query(
    `SELECT p.id, p.name, pr.base_fee, pr.markup_type, pr.markup_value, pr.currency
     FROM bill_providers p
     JOIN bill_pricing pr ON pr.provider_id = p.id
     WHERE p.code = ? AND p.active = 1 AND pr.active = 1`,
    [providerCode]
  );
  if (!rows.length) return res.status(404).json({ error: 'Provider not found' });

  const pricing = rows[0];
  const markup =
    pricing.markup_type === 'percent'
      ? (numericAmount * Number(pricing.markup_value)) / 100
      : Number(pricing.markup_value);
  const fee = Number(pricing.base_fee) + markup;
  const total = numericAmount + fee;

  return res.json({
    provider: pricing.name,
    amount: numericAmount,
    fee,
    total,
    currency: pricing.currency,
  });
});

router.post('/pay', requireUser, async (req, res) => {
  const { providerCode, amount, account } = req.body || {};
  const numericAmount = Number(amount);
  if (!providerCode || !numericAmount || numericAmount <= 0 || !account) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const [rows] = await pool.query(
    `SELECT p.id, p.name, pr.base_fee, pr.markup_type, pr.markup_value, pr.currency
     FROM bill_providers p
     JOIN bill_pricing pr ON pr.provider_id = p.id
     WHERE p.code = ? AND p.active = 1 AND pr.active = 1`,
    [providerCode]
  );
  if (!rows.length) return res.status(404).json({ error: 'Provider not found' });

  const pricing = rows[0];
  const markup =
    pricing.markup_type === 'percent'
      ? (numericAmount * Number(pricing.markup_value)) / 100
      : Number(pricing.markup_value);
  const fee = Number(pricing.base_fee) + markup;
  const total = numericAmount + fee;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [walletRows] = await conn.query(
      'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [req.user.sub]
    );
    if (!walletRows.length) throw new Error('Wallet missing');
    if (Number(walletRows[0].balance) < total) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await conn.query('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [
      total,
      req.user.sub,
    ]);

    const reference = `BILL-${nanoid(10)}`;
    await conn.query(
      'INSERT INTO bill_orders (id, user_id, provider_id, amount, fee, total, status, reference) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)',
      [req.user.sub, pricing.id, numericAmount, fee, total, 'success', reference]
    );
    await conn.query(
      'INSERT INTO transactions (id, user_id, type, amount, fee, total, status, reference, metadata) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.sub,
        'bill',
        numericAmount,
        fee,
        total,
        'success',
        reference,
        JSON.stringify({ provider: pricing.name, account }),
      ]
    );
    await conn.commit();
    const [[user]] = await pool.query('SELECT full_name, email FROM users WHERE id = ?', [
      req.user.sub,
    ]);
    sendReceiptEmail({
      to: user.email,
      name: user.full_name,
      title: 'Bill Payment Successful',
      details: [
        `Service: ${pricing.name}`,
        `Amount: ₦${numericAmount.toFixed(2)}`,
        `Fee: ₦${fee.toFixed(2)}`,
        `Total: ₦${total.toFixed(2)}`,
        `Reference: ${reference}`,
      ],
    }).catch(console.error);
    logAudit({
      actorType: 'user',
      actorId: req.user.sub,
      action: 'bill.paid',
      entityType: 'bill_order',
      entityId: reference,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { provider: pricing.name, account },
    }).catch(console.error);
    return res.json({ message: 'Bill paid', reference, total });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: 'Payment failed' });
  } finally {
    conn.release();
  }
});

export default router;
