import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.get('/events', requireAdmin, requirePermission('monnify:read'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 200);
  const offset = Number(req.query.offset || 0);
  const status = req.query.status || '';
  const filters = [];
  const params = [];
  if (status) {
    filters.push('status = ?');
    params.push(status);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT payment_reference, account_reference, amount, currency, paid_on, status, attempts, last_error, updated_at
     FROM monnify_events
     ${where}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return res.json(rows);
});

router.get('/metrics', requireAdmin, requirePermission('monnify:read'), async (req, res) => {
  const [[total]] = await pool.query('SELECT COUNT(*) as total FROM monnify_events');
  const [[failed]] = await pool.query(
    'SELECT COUNT(*) as total FROM monnify_events WHERE status = "failed"'
  );
  return res.json({
    total: total.total,
    failed: failed.total,
    failureRate: total.total ? Number((failed.total / total.total) * 100) : 0,
  });
});

router.post('/retry', requireAdmin, requirePermission('monnify:retry'), async (req, res) => {
  const { paymentReference } = req.body || {};
  if (!paymentReference) return res.status(400).json({ error: 'Missing payment reference' });
  await pool.query(
    'UPDATE monnify_events SET status = ?, last_error = NULL WHERE payment_reference = ?',
    ['received', paymentReference]
  );
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'monnify.retry.requested',
    entityType: 'monnify_event',
    entityId: paymentReference,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Retry scheduled' });
});

export default router;
