import express from 'express';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { getCachedBanks } from '../utils/bankCache.js';
import { validateBankAccount } from '../utils/monnify.js';

const router = express.Router();

router.get('/', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['Banks']
    #swagger.summary = 'Get cached bank list'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'Banks',
      schema: { type: 'array', items: { $ref: '#/definitions/Bank' } }
    }
  */
  const banks = await getCachedBanks();
  return res.json(banks);
});

router.post('/resolve', requireUser, async (req, res) => {
  /*
    #swagger.tags = ['Banks']
    #swagger.summary = 'Resolve bank account name'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/BankResolveRequest' } }
    #swagger.responses[200] = {
      description: 'Resolution result',
      schema: { type: 'object', properties: { found: { type: 'boolean' } } }
    }
    #swagger.responses[400] = { description: 'Validation error', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const { accountNumber, bankCode } = req.body || {};
  if (!accountNumber || String(accountNumber).length < 8) {
    return res.status(400).json({ error: 'Account number required' });
  }

  if (bankCode) {
    const [[bank]] = await pool.query('SELECT name FROM banks WHERE code = ? AND active = 1', [
      bankCode,
    ]);
    if (!bank) return res.status(400).json({ error: 'Invalid bank selected' });
    try {
      const result = await validateBankAccount({ accountNumber, bankCode });
      if (result?.accountName) {
        return res.json({
          found: true,
          accountName: result.accountName,
          bankName: bank.name,
          bankCode,
        });
      }
      return res.json({ found: false, bankCode, bankName: bank.name });
    } catch (err) {
      return res.status(400).json({ error: 'Account verification failed' });
    }
  }

  const banks = await getCachedBanks();
  return res.json({ found: false, banks });
});

export default router;
