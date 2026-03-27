import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { sendReceiptEmail } from '../utils/email.js';
import { logAudit } from '../utils/audit.js';
import { verifyTransactionPin, isValidPin } from '../utils/pin.js';
import { enforceSecurityQuestion } from '../utils/securityQuestionGuard.js';

const router = express.Router();

router.get('/balance', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['Wallet']
    #swagger.summary = 'Get wallet balance'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Balance', schema: { $ref: '#/definitions/WalletBalance' } }
    #swagger.responses[404] = { description: 'Wallet not found', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const [rows] = await pool.query(
    'SELECT balance, currency FROM wallets WHERE user_id = ?',
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'Wallet not found' });
  return res.json(rows[0]);
});

router.post('/send', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['Wallet']
    #swagger.summary = 'Send money to bank or internal user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/WalletSendRequest' } }
    #swagger.responses[200] = { description: 'Transfer created', schema: { $ref: '#/definitions/WalletSendResponse' } }
    #swagger.responses[400] = { description: 'Validation error', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const { amount, pin, accountNumber, bankCode, accountName, to, channel, securityAnswer } =
    req.body || {};
  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  if (!isValidPin(pin)) return res.status(400).json({ error: 'Invalid transaction PIN' });
  try {
    await verifyTransactionPin(req.user.sub, pin);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const enforcement = await enforceSecurityQuestion({
    userId: req.user.sub,
    answer: securityAnswer,
    flow: 'transfer',
    amount: numericAmount,
  });
  if (!enforcement.ok) {
    return res.status(enforcement.status).json({ error: enforcement.message });
  }

  const isBank = channel === 'bank' || accountNumber || bankCode;
  let recipientId = null;
  let bankName = null;
  if (isBank) {
    if (!accountNumber || !bankCode || !accountName) {
      return res.status(400).json({ error: 'Account number, bank, and name are required' });
    }
    const [[bank]] = await pool.query('SELECT name FROM banks WHERE code = ? AND active = 1', [
      bankCode,
    ]);
    if (!bank) return res.status(400).json({ error: 'Invalid bank selected' });
    bankName = bank.name;
  } else {
    if (!to) return res.status(400).json({ error: 'Recipient required' });
    const [targets] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [to, to]
    );
    if (!targets.length) return res.status(404).json({ error: 'Recipient not found' });
    recipientId = targets[0].id;
  }

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

    const reference = `TX-${nanoid(10)}`;
    if (isBank) {
      await conn.query(
        'INSERT INTO transactions (id, user_id, type, amount, fee, total, status, reference, metadata) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          req.user.sub,
          'send',
          numericAmount,
          0,
          numericAmount,
          'pending',
          reference,
          JSON.stringify({
            channel: 'bank',
            bankCode,
            bankName,
            accountNumber,
            accountName,
          }),
        ]
      );
    } else {
      await conn.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [
        numericAmount,
        recipientId,
      ]);
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
          JSON.stringify({ to, channel: 'internal' }),
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
    }
    await conn.commit();
    const [[sender]] = await pool.query(
      'SELECT full_name, email FROM users WHERE id = ?',
      [req.user.sub]
    );
    sendReceiptEmail({
      to: sender.email,
      name: sender.full_name,
      title: isBank ? 'Transfer Initiated' : 'Transfer Successful',
      details: [
        `Amount: NGN ${numericAmount.toFixed(2)}`,
        isBank ? `Recipient: ${accountName} (${accountNumber})` : `Recipient: ${to}`,
        `Reference: ${reference}`,
      ],
    }).catch(console.error);
    if (!isBank) {
      const [[recipient]] = await pool.query(
        'SELECT full_name, email FROM users WHERE id = ?',
        [recipientId]
      );
      sendReceiptEmail({
        to: recipient.email,
        name: recipient.full_name,
        title: 'Money Received',
        details: [
          `Amount: NGN ${numericAmount.toFixed(2)}`,
          `Sender: ${sender.full_name}`,
          `Reference: ${reference}`,
        ],
      }).catch(console.error);
    }
    logAudit({
      actorType: 'user',
      actorId: req.user.sub,
      action: isBank ? 'wallet.bank_transfer' : 'wallet.transfer',
      entityType: 'transaction',
      entityId: reference,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: isBank ? { bankCode, bankName, accountNumber } : { to },
    }).catch(console.error);
    return res.json({
      message: isBank ? 'Transfer initiated' : 'Transfer completed',
      reference,
      status: isBank ? 'pending' : 'success',
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: 'Transfer failed' });
  } finally {
    conn.release();
  }
});

router.post('/receive', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['Wallet']
    #swagger.summary = 'Request money from another user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/WalletReceiveRequest' } }
    #swagger.responses[200] = { description: 'Request created', schema: { $ref: '#/definitions/WalletReceiveResponse' } }
  */
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
