import express from 'express';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { logAudit } from '../utils/audit.js';
import { sendReceiptEmail } from '../utils/email.js';

const router = express.Router();

function verifySignature(req) {
  const secret = process.env.MONNIFY_WEBHOOK_SECRET || process.env.MONNIFY_SECRET_KEY || '';
  if (!secret) return true;
  const signature = (req.headers['monnify-signature'] || '').toString();
  if (!signature || !req.rawBody) return false;
  const hash = crypto
    .createHash('sha512')
    .update(secret + req.rawBody)
    .digest('hex');
  return hash === signature;
}

function ipAllowed(req) {
  const ips = (process.env.MONNIFY_WEBHOOK_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ips.length) return true;
  const ip = (req.ip || '').replace('::ffff:', '');
  return ips.includes(ip);
}

router.post('/', async (req, res) => {
  if (!ipAllowed(req)) return res.status(403).send('Forbidden');
  if (!verifySignature(req)) return res.status(401).send('Invalid signature');

  const payload = req.body || {};
  const eventType = payload.eventType || payload.eventTypeCode || '';
  const eventData = payload.eventData || payload.responseBody || {};

  const paymentReference =
    eventData.paymentReference ||
    eventData.transactionReference ||
    eventData.paymentReferenceNumber ||
    eventData.payment?.paymentReference;

  const amount = Number(eventData.amountPaid || eventData.amount || 0);
  const currency = eventData.currencyCode || 'NGN';
  const paidOn = eventData.paidOn || eventData.paymentDate;

  const accountReference =
    eventData.product?.reference ||
    eventData.accountReference ||
    eventData.customer?.accountReference;

  const accountNumber =
    eventData.destinationAccountInformation?.accountNumber ||
    eventData.accountNumber;

  if (!paymentReference || amount <= 0) {
    return res.status(200).json({ received: true });
  }

  const [existing] = await pool.query(
    'SELECT id FROM monnify_events WHERE payment_reference = ? LIMIT 1',
    [paymentReference]
  );
  if (existing.length) {
    return res.json({ received: true, duplicate: true });
  }

  const [accounts] = await pool.query(
    `SELECT r.user_id, r.account_reference, r.account_number
     FROM reserved_accounts r
     WHERE r.account_reference = ? OR r.account_number = ?
     LIMIT 1`,
    [accountReference || '', accountNumber || '']
  );
  if (!accounts.length) {
    await pool.query(
      'INSERT INTO monnify_events (id, payment_reference, account_reference, amount, currency, paid_on, raw_payload) VALUES (UUID(), ?, ?, ?, ?, ?, ?)',
      [
        paymentReference,
        accountReference || null,
        amount,
        currency,
        paidOn || null,
        JSON.stringify(payload),
      ]
    );
    return res.json({ received: true, unmatched: true });
  }

  const userId = accounts[0].user_id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO monnify_events (id, payment_reference, account_reference, amount, currency, paid_on, raw_payload) VALUES (UUID(), ?, ?, ?, ?, ?, ?)',
      [
        paymentReference,
        accountReference || accounts[0].account_reference,
        amount,
        currency,
        paidOn || null,
        JSON.stringify(payload),
      ]
    );
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [
      amount,
      userId,
    ]);
    const reference = `MON-${paymentReference}`;
    await conn.query(
      'INSERT INTO transactions (id, user_id, type, amount, fee, total, status, reference, metadata) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        'topup',
        amount,
        0,
        amount,
        'success',
        reference,
        JSON.stringify({ provider: 'monnify', paymentReference }),
      ]
    );
    await conn.commit();

    const [[user]] = await pool.query('SELECT full_name, email FROM users WHERE id = ?', [
      userId,
    ]);
    if (user?.email) {
      sendReceiptEmail({
        to: user.email,
        name: user.full_name,
        title: 'Wallet Credit Successful',
        details: [
          `Amount: NGN ${amount.toFixed(2)}`,
          `Reference: ${paymentReference}`,
          `Channel: Monnify Transfer`,
        ],
      }).catch(console.error);
    }
    logAudit({
      actorType: 'system',
      actorId: null,
      action: 'wallet.credit',
      entityType: 'transaction',
      entityId: reference,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { paymentReference },
    }).catch(console.error);
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: 'Processing failed' });
  } finally {
    conn.release();
  }

  return res.json({ received: true });
});

export default router;
