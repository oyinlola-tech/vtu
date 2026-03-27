import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

router.get('/categories', requireAdmin, requirePermission('bills:read'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'List bill categories'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Categories', schema: { type: 'array', items: { type: 'object' } } }
  */
  const [rows] = await pool.query(
    'SELECT id, code, name, description, active FROM bill_categories ORDER BY name'
  );
  return res.json(rows);
});

router.post('/categories', requireAdmin, requirePermission('bills:write'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'Create bill category'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/AdminBillsCategoryRequest' } }
    #swagger.responses[201] = { description: 'Created', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { code, name, description } = req.body || {};
  if (!code || !name || !description) return res.status(400).json({ error: 'Missing fields' });
  await pool.query(
    'INSERT INTO bill_categories (code, name, description, active) VALUES (?, ?, ?, 1)',
    [code, name, description]
  );
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.bill_category.create',
    entityType: 'bill_category',
    entityId: code,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.status(201).json({ message: 'Category created' });
});

router.put('/categories/:id', requireAdmin, requirePermission('bills:write'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'Update bill category'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/AdminBillsCategoryUpdateRequest' } }
    #swagger.responses[200] = { description: 'Updated', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { name, description, active } = req.body || {};
  await pool.query(
    'UPDATE bill_categories SET name = ?, description = ?, active = ? WHERE id = ?',
    [name, description, active ? 1 : 0, req.params.id]
  );
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.bill_category.update',
    entityType: 'bill_category',
    entityId: req.params.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Category updated' });
});

router.get('/providers', requireAdmin, requirePermission('bills:read'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'List bill providers'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Providers', schema: { type: 'array', items: { type: 'object' } } }
  */
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.code, p.active, c.name as category_name
     FROM bill_providers p
     JOIN bill_categories c ON c.id = p.category_id
     ORDER BY p.name`
  );
  return res.json(rows);
});

router.post('/providers', requireAdmin, requirePermission('bills:write'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'Create bill provider'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/AdminBillsProviderRequest' } }
    #swagger.responses[201] = { description: 'Created', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { categoryId, name, code } = req.body || {};
  if (!categoryId || !name || !code) return res.status(400).json({ error: 'Missing fields' });
  await pool.query(
    'INSERT INTO bill_providers (category_id, name, code, active) VALUES (?, ?, ?, 1)',
    [categoryId, name, code]
  );
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.bill_provider.create',
    entityType: 'bill_provider',
    entityId: code,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.status(201).json({ message: 'Provider created' });
});

router.put('/providers/:id', requireAdmin, requirePermission('bills:write'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'Update bill provider'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/AdminBillsProviderUpdateRequest' } }
    #swagger.responses[200] = { description: 'Updated', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { name, code, active } = req.body || {};
  await pool.query(
    'UPDATE bill_providers SET name = ?, code = ?, active = ? WHERE id = ?',
    [name, code, active ? 1 : 0, req.params.id]
  );
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.bill_provider.update',
    entityType: 'bill_provider',
    entityId: req.params.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Provider updated' });
});

router.get('/pricing', requireAdmin, requirePermission('pricing:read'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'List bill pricing rules'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Pricing', schema: { type: 'array', items: { type: 'object' } } }
  */
  const [rows] = await pool.query(
    `SELECT pr.id, p.name as provider, pr.base_fee, pr.markup_type, pr.markup_value, pr.currency, pr.active
     FROM bill_pricing pr
     JOIN bill_providers p ON p.id = pr.provider_id
     ORDER BY p.name`
  );
  return res.json(rows);
});

router.post('/pricing', requireAdmin, requirePermission('pricing:write'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'Create pricing rule'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/AdminPricingRequest' } }
    #swagger.responses[201] = { description: 'Created', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { providerId, baseFee, markupType, markupValue, currency } = req.body || {};
  if (!providerId) return res.status(400).json({ error: 'Missing provider' });
  await pool.query(
    'INSERT INTO bill_pricing (provider_id, base_fee, markup_type, markup_value, currency, active) VALUES (?, ?, ?, ?, ?, 1)',
    [providerId, baseFee || 0, markupType || 'flat', markupValue || 0, currency || 'NGN']
  );
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.pricing.create',
    entityType: 'pricing',
    entityId: String(providerId),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.status(201).json({ message: 'Pricing created' });
});

router.put('/pricing/:id', requireAdmin, requirePermission('pricing:write'), async (req, res) => {
  /*
    #swagger.tags = ['Admin Bills']
    #swagger.summary = 'Update pricing rule'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/AdminPricingUpdateRequest' } }
    #swagger.responses[200] = { description: 'Updated', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { baseFee, markupType, markupValue, currency, active } = req.body || {};
  await pool.query(
    'UPDATE bill_pricing SET base_fee = ?, markup_type = ?, markup_value = ?, currency = ?, active = ? WHERE id = ?',
    [baseFee || 0, markupType || 'flat', markupValue || 0, currency || 'NGN', active ? 1 : 0, req.params.id]
  );
  logAudit({
    actorType: 'admin',
    actorId: req.admin.sub,
    action: 'admin.pricing.update',
    entityType: 'pricing',
    entityId: req.params.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Pricing updated' });
});

export default router;
