import express from 'express';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

router.get('/categories', requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, code, name, description, active FROM bill_categories ORDER BY name'
  );
  return res.json(rows);
});

router.post('/categories', requireAdmin, async (req, res) => {
  const { code, name, description } = req.body || {};
  if (!code || !name || !description) return res.status(400).json({ error: 'Missing fields' });
  await pool.query(
    'INSERT INTO bill_categories (code, name, description, active) VALUES (?, ?, ?, 1)',
    [code, name, description]
  );
  return res.status(201).json({ message: 'Category created' });
});

router.put('/categories/:id', requireAdmin, async (req, res) => {
  const { name, description, active } = req.body || {};
  await pool.query(
    'UPDATE bill_categories SET name = ?, description = ?, active = ? WHERE id = ?',
    [name, description, active ? 1 : 0, req.params.id]
  );
  return res.json({ message: 'Category updated' });
});

router.get('/providers', requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.code, p.active, c.name as category_name
     FROM bill_providers p
     JOIN bill_categories c ON c.id = p.category_id
     ORDER BY p.name`
  );
  return res.json(rows);
});

router.post('/providers', requireAdmin, async (req, res) => {
  const { categoryId, name, code } = req.body || {};
  if (!categoryId || !name || !code) return res.status(400).json({ error: 'Missing fields' });
  await pool.query(
    'INSERT INTO bill_providers (category_id, name, code, active) VALUES (?, ?, ?, 1)',
    [categoryId, name, code]
  );
  return res.status(201).json({ message: 'Provider created' });
});

router.put('/providers/:id', requireAdmin, async (req, res) => {
  const { name, code, active } = req.body || {};
  await pool.query(
    'UPDATE bill_providers SET name = ?, code = ?, active = ? WHERE id = ?',
    [name, code, active ? 1 : 0, req.params.id]
  );
  return res.json({ message: 'Provider updated' });
});

router.get('/pricing', requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT pr.id, p.name as provider, pr.base_fee, pr.markup_type, pr.markup_value, pr.currency, pr.active
     FROM bill_pricing pr
     JOIN bill_providers p ON p.id = pr.provider_id
     ORDER BY p.name`
  );
  return res.json(rows);
});

router.post('/pricing', requireAdmin, async (req, res) => {
  const { providerId, baseFee, markupType, markupValue, currency } = req.body || {};
  if (!providerId) return res.status(400).json({ error: 'Missing provider' });
  await pool.query(
    'INSERT INTO bill_pricing (provider_id, base_fee, markup_type, markup_value, currency, active) VALUES (?, ?, ?, ?, ?, 1)',
    [providerId, baseFee || 0, markupType || 'flat', markupValue || 0, currency || 'NGN']
  );
  return res.status(201).json({ message: 'Pricing created' });
});

router.put('/pricing/:id', requireAdmin, async (req, res) => {
  const { baseFee, markupType, markupValue, currency, active } = req.body || {};
  await pool.query(
    'UPDATE bill_pricing SET base_fee = ?, markup_type = ?, markup_value = ?, currency = ?, active = ? WHERE id = ?',
    [baseFee || 0, markupType || 'flat', markupValue || 0, currency || 'NGN', active ? 1 : 0, req.params.id]
  );
  return res.json({ message: 'Pricing updated' });
});

export default router;
