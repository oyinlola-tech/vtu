import express from 'express';
import PDFDocument from 'pdfkit';
import { pool } from '../config/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = express.Router();

router.get('/overview', requireAdmin, requirePermission('finance:read'), async (req, res) => {
  const [[users]] = await pool.query('SELECT COUNT(*) as total FROM users');
  const [[volume]] = await pool.query('SELECT SUM(total) as total FROM transactions WHERE status = "success"');
  const [[revenue]] = await pool.query('SELECT SUM(fee) as total FROM transactions WHERE status = "success"');
  const [[credits]] = await pool.query(
    'SELECT SUM(total) as total FROM transactions WHERE status = "success" AND type IN ("receive")'
  );
  const [[debits]] = await pool.query(
    'SELECT SUM(total) as total FROM transactions WHERE status = "success" AND type IN ("send","bill","topup")'
  );
  const [[balances]] = await pool.query('SELECT SUM(balance) as total FROM wallets');

  return res.json({
    users: users.total,
    volume: Number(volume.total || 0),
    revenue: Number(revenue.total || 0),
    credits: Number(credits.total || 0),
    debits: Number(debits.total || 0),
    walletBalance: Number(balances.total || 0),
  });
});

router.get('/balances', requireAdmin, requirePermission('finance:read'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 200);
  const offset = Number(req.query.offset || 0);
  const [rows] = await pool.query(
    `SELECT u.full_name, u.email, w.balance, w.currency, w.updated_at
     FROM wallets w
     JOIN users u ON u.id = w.user_id
     ORDER BY w.balance DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return res.json(rows);
});

router.get('/export', requireAdmin, requirePermission('finance:read'), async (req, res) => {
  const format = (req.query.format || 'csv').toString().toLowerCase();
  const from = req.query.from;
  const to = req.query.to;
  const filters = [];
  const params = [];
  if (from) {
    filters.push('created_at >= ?');
    params.push(from);
  }
  if (to) {
    filters.push('created_at <= ?');
    params.push(to);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [[volume]] = await pool.query(
    `SELECT SUM(total) as total FROM transactions ${where}`,
    params
  );
  const [[revenue]] = await pool.query(
    `SELECT SUM(fee) as total FROM transactions ${where}`,
    params
  );
  const [[credits]] = await pool.query(
    `SELECT SUM(total) as total FROM transactions ${where} ${
      where ? 'AND' : 'WHERE'
    } type IN ("receive")`,
    params
  );
  const [[debits]] = await pool.query(
    `SELECT SUM(total) as total FROM transactions ${where} ${
      where ? 'AND' : 'WHERE'
    } type IN ("send","bill","topup")`,
    params
  );

  if (format === 'pdf') {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="finance-report.pdf"');
    doc.pipe(res);
    doc.fontSize(18).text('GLY VTU Finance Report');
    doc.moveDown();
    doc.fontSize(12).text(`From: ${from || 'All time'}`);
    doc.fontSize(12).text(`To: ${to || 'Now'}`);
    doc.moveDown();
    doc.fontSize(12).text(`Total Volume: ₦${Number(volume.total || 0).toFixed(2)}`);
    doc.fontSize(12).text(`Total Revenue: ₦${Number(revenue.total || 0).toFixed(2)}`);
    doc.fontSize(12).text(`Total Credits: ₦${Number(credits.total || 0).toFixed(2)}`);
    doc.fontSize(12).text(`Total Debits: ₦${Number(debits.total || 0).toFixed(2)}`);
    doc.end();
    return;
  }

  const csv = [
    ['Metric', 'Value'],
    ['From', from || 'All time'],
    ['To', to || 'Now'],
    ['Total Volume', Number(volume.total || 0).toFixed(2)],
    ['Total Revenue', Number(revenue.total || 0).toFixed(2)],
    ['Total Credits', Number(credits.total || 0).toFixed(2)],
    ['Total Debits', Number(debits.total || 0).toFixed(2)],
  ]
    .map((row) => row.map((c) => `"${String(c).replace(/\"/g, '""')}"`).join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="finance-report.csv"');
  res.send(csv);
});

export default router;
