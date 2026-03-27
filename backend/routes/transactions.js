import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';

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

export default router;
