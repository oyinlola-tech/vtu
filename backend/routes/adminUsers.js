import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logAudit } from '../utils/audit.js';
import { sendKycStatusEmail } from '../utils/email.js';

const router = express.Router();

router.get('/', requireAdmin, requirePermission('users:read'), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, phone, kyc_level, kyc_status, created_at FROM users ORDER BY created_at DESC LIMIT 200'
  );
  return res.json(rows);
});

router.put('/:id/kyc', requireAdmin, requirePermission('users:kyc'), async (req, res) => {
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

export default router;
