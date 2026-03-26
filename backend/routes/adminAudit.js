import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = express.Router();

router.get('/', requireAdmin, requirePermission('audit:read'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 200);
  const offset = Number(req.query.offset || 0);
  const [rows] = await pool.query(
    `SELECT id, actor_type, actor_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return res.json(rows);
});

export default router;
