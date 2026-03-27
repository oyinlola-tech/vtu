import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { sendStatementEmail } from '../utils/email.js';

const router = express.Router();

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

  const [rows] = await pool.query(
    `SELECT id, type, amount, fee, total, status, reference, created_at
     FROM transactions
     WHERE user_id = ?
       AND created_at >= CONCAT(?, ' 00:00:00')
       AND created_at <= CONCAT(?, ' 23:59:59')
     ORDER BY created_at DESC
     LIMIT 1000`,
    [req.user.sub, startDate, endDate]
  );

  await sendStatementEmail({
    to: user.email,
    name: user.full_name,
    startDate,
    endDate,
    transactions: rows,
  });

  return res.json({ message: 'Statement sent to your email' });
});

export default router;
