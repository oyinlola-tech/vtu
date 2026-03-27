import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logAudit } from '../utils/audit.js';
import { sendKycStatusEmail } from '../utils/email.js';
import { createReservedAccount } from '../utils/monnify.js';
import { sendReservedAccountEmail } from '../utils/email.js';

const router = express.Router();

router.get('/', requireAdmin, requirePermission('users:read'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Users']
    #swagger.summary = 'List users'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Users', schema: { type: 'array', items: { $ref: '#/definitions/AdminUserListItem' } } }
  */
  const [rows] = await pool.query(
    'SELECT id, full_name, email, phone, kyc_level, kyc_status, created_at FROM users ORDER BY created_at DESC LIMIT 200'
  );
  return res.json(rows);
});

router.put('/:id/kyc', requireAdmin, requirePermission('users:kyc'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Users']
    #swagger.summary = 'Update user KYC status'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/AdminKycUpdateRequest' } }
    #swagger.responses[200] = { description: 'Updated', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { status, level } = req.body || {};
  if (!['verified', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await pool.query('UPDATE users SET kyc_status = ?, kyc_level = ? WHERE id = ?', [
    status,
    Number(level || 1),
    req.params.id,
  ]);
  const [[user]] = await pool.query('SELECT full_name, email FROM users WHERE id = ?', [
    req.params.id,
  ]);
  if (user?.email) {
    sendKycStatusEmail({
      to: user.email,
      name: user.full_name,
      status,
    }).catch(console.error);
  }
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.kyc.update',
    entityType: 'user',
    entityId: req.params.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: { status, level: Number(level || 1) },
  }).catch(console.error);
  return res.json({ message: 'KYC updated' });
});

router.post('/:id/reserved-account', requireAdmin, requirePermission('accounts:write'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Users']
    #swagger.summary = 'Create reserved account for user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Created', schema: { $ref: '#/definitions/MessageResponse' } }
    #swagger.responses[409] = { description: 'Already exists', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
  const userId = req.params.id;
  const [existing] = await pool.query(
    'SELECT id FROM reserved_accounts WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (existing.length) return res.status(409).json({ error: 'Account already exists' });

  const [[user]] = await pool.query(
    'SELECT full_name, email, kyc_payload FROM users WHERE id = ?',
    [userId]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  const payload = user.kyc_payload ? JSON.parse(user.kyc_payload) : {};
  const bvn = payload.bvn;
  const nin = payload.nin;
  if (!bvn && !nin) return res.status(400).json({ error: 'BVN or NIN required' });

  const accountReference = `GLY-${userId}`;
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
      userId,
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
  sendReservedAccountEmail({
    to: user.email,
    name: user.full_name,
    accountNumber: account.accountNumber || reserved?.accountNumber,
    bankName: account.bankName || reserved?.bankName,
  }).catch(console.error);
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.reserved_account.create',
    entityType: 'user',
    entityId: userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Reserved account created' });
});

export default router;
