import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { generateStatementPdf, sendStatementEmail } from '../utils/email.js';

const router = express.Router();

const creditTypes = new Set(['receive', 'topup']);
const debitTypes = new Set(['send', 'bill']);

function getTransactionDelta(row) {
  if (row.status !== 'success') return 0;
  if (creditTypes.has(row.type)) return Number(row.total || 0);
  if (debitTypes.has(row.type)) return -Number(row.total || 0);
  return 0;
}

async function buildStatementData({ userId, startDate, endDate }) {
  const [[wallet]] = await pool.query(
    'SELECT balance FROM wallets WHERE user_id = ?',
    [userId]
  );
  const currentBalance = Number(wallet?.balance || 0);
  const [[after]] = await pool.query(
    `SELECT COALESCE(SUM(CASE
      WHEN status = 'success' AND type IN ('receive','topup') THEN total
      WHEN status = 'success' AND type IN ('send','bill') THEN -total
      ELSE 0
    END), 0) AS net
     FROM transactions
     WHERE user_id = ?
       AND created_at > CONCAT(?, ' 23:59:59')`,
    [userId, endDate]
  );
  const netAfter = Number(after?.net || 0);
  const closingBalance = currentBalance - netAfter;

  const [rows] = await pool.query(
    `SELECT id, type, amount, fee, total, status, reference, created_at
     FROM transactions
     WHERE user_id = ?
       AND created_at >= CONCAT(?, ' 00:00:00')
       AND created_at <= CONCAT(?, ' 23:59:59')
     ORDER BY created_at ASC
     LIMIT 1000`,
    [userId, startDate, endDate]
  );

  const netWithin = rows.reduce((sum, row) => sum + getTransactionDelta(row), 0);
  const openingBalance = closingBalance - netWithin;

  let running = openingBalance;
  const enriched = rows.map((row) => {
    running += getTransactionDelta(row);
    return { ...row, running_balance: running };
  });

  return { rows: enriched, openingBalance, closingBalance };
}

router.get('/', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['Transactions']
    #swagger.summary = 'List recent transactions'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'Transactions',
      schema: { type: 'array', items: { $ref: '#/definitions/TransactionItem' } }
    }
  */
  const [rows] = await pool.query(
    'SELECT id, type, amount, fee, total, status, reference, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user.sub]
  );
  return res.json(rows);
});

router.post('/statement', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['Transactions']
    #swagger.summary = 'Email account statement PDF'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        type: 'object',
        properties: {
          startDate: { type: 'string', example: '2026-01-01' },
          endDate: { type: 'string', example: '2026-01-31' }
        }
      }
    }
    #swagger.responses[200] = { description: 'Statement queued', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { startDate, endDate } = req.body || {};
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!startDate || !endDate || !datePattern.test(startDate) || !datePattern.test(endDate)) {
    return res.status(400).json({ error: 'Start and end date are required (YYYY-MM-DD)' });
  }
  if (startDate > endDate) {
    return res.status(400).json({ error: 'Start date must be before end date' });
  }

  const [[user]] = await pool.query(
    'SELECT full_name, email FROM users WHERE id = ?',
    [req.user.sub]
  );
  if (!user?.email) {
    return res.status(400).json({ error: 'Email address not found' });
  }

  const { rows, openingBalance, closingBalance } = await buildStatementData({
    userId: req.user.sub,
    startDate,
    endDate,
  });

  await sendStatementEmail({
    to: user.email,
    name: user.full_name,
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    transactions: rows,
  });

  return res.json({ message: 'Statement sent to your email' });
});

router.post('/statement/download', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['Transactions']
    #swagger.summary = 'Download account statement PDF'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: {
        type: 'object',
        properties: {
          startDate: { type: 'string', example: '2026-01-01' },
          endDate: { type: 'string', example: '2026-01-31' }
        }
      }
    }
  */
  const { startDate, endDate } = req.body || {};
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!startDate || !endDate || !datePattern.test(startDate) || !datePattern.test(endDate)) {
    return res.status(400).json({ error: 'Start and end date are required (YYYY-MM-DD)' });
  }
  if (startDate > endDate) {
    return res.status(400).json({ error: 'Start date must be before end date' });
  }

  const [[user]] = await pool.query(
    'SELECT full_name FROM users WHERE id = ?',
    [req.user.sub]
  );

  const { rows, openingBalance, closingBalance } = await buildStatementData({
    userId: req.user.sub,
    startDate,
    endDate,
  });

  const pdf = await generateStatementPdf({
    name: user?.full_name,
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    transactions: rows,
  });

  const filename = `glyvtu-statement-${startDate}-to-${endDate}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(pdf);
});

export default router;
