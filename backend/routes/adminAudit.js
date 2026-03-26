import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = express.Router();

router.get('/', requireAdmin, requirePermission('audit:read'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 200);
  const offset = Number(req.query.offset || 0);
  const filters = [];
  const params = [];
  if (req.query.actorType) {
    filters.push('actor_type = ?');
    params.push(req.query.actorType);
  }
  if (req.query.actorId) {
    filters.push('actor_id = ?');
    params.push(req.query.actorId);
  }
  if (req.query.action) {
    filters.push('action = ?');
    params.push(req.query.action);
  }
  if (req.query.entityType) {
    filters.push('entity_type = ?');
    params.push(req.query.entityType);
  }
  if (req.query.from) {
    filters.push('created_at >= ?');
    params.push(req.query.from);
  }
  if (req.query.to) {
    filters.push('created_at <= ?');
    params.push(req.query.to);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, actor_type, actor_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at
     FROM audit_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return res.json(rows);
});

export default router;
