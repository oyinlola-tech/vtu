import { pool } from '../config/db.js';

export async function logAudit({
  actorType,
  actorId = null,
  action,
  entityType = null,
  entityId = null,
  ip = null,
  userAgent = null,
  metadata = null,
}) {
  await pool.query(
    `INSERT INTO audit_logs (id, actor_type, actor_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      ip,
      userAgent,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}
