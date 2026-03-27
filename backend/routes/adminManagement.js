import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission, rolePermissions } from '../middleware/permissions.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.get('/', requireAdmin, requirePermission('admin:manage'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Management']
    #swagger.summary = 'List admin users'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Admins', schema: { type: 'array', items: { $ref: '#/definitions/AdminUser' } } }
  */
  const [rows] = await pool.query(
    'SELECT id, name, email, role, created_at FROM admin_users ORDER BY created_at DESC'
  );
  return res.json(rows);
});

router.get('/roles', requireAdmin, requirePermission('admin:manage'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Management']
    #swagger.summary = 'List available roles'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Roles', schema: { type: 'array', items: { type: 'string' } } }
  */
  return res.json(Object.keys(rolePermissions));
});

router.post('/', requireAdmin, requirePermission('admin:manage'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Management']
    #swagger.summary = 'Create an admin user'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/AdminCreateRequest' } }
    #swagger.responses[201] = { description: 'Created', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!rolePermissions[role]) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const [existing] = await pool.query('SELECT id FROM admin_users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'Admin already exists' });

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO admin_users (id, name, email, password_hash, role) VALUES (UUID(), ?, ?, ?, ?)',
    [name, email, passwordHash, role]
  );

  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.create',
    entityType: 'admin',
    entityId: email,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: { role },
  }).catch(console.error);

  return res.status(201).json({ message: 'Admin created' });
});

router.put('/:id/role', requireAdmin, requirePermission('admin:manage'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Management']
    #swagger.summary = 'Update admin role'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/AdminRoleUpdateRequest' } }
    #swagger.responses[200] = { description: 'Updated', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { role } = req.body || {};
  if (!role || !rolePermissions[role]) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  await pool.query('UPDATE admin_users SET role = ? WHERE id = ?', [role, req.params.id]);
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.role.update',
    entityType: 'admin',
    entityId: req.params.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: { role },
  }).catch(console.error);
  return res.json({ message: 'Role updated' });
});

export default router;
