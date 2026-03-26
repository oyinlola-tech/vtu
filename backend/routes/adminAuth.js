import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../utils/tokens.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { logAudit } from '../utils/audit.js';

const router = express.Router();

const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET || 'dev_secret_change_me';
const USE_COOKIE_REFRESH = (process.env.COOKIE_REFRESH || 'true') === 'true';

function setRefreshCookie(res, token, expiresAt) {
  if (!USE_COOKIE_REFRESH) return;
  res.cookie('admin_refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    expires: expiresAt,
  });
}

function setAccessCookie(res, token) {
  res.cookie('admin_access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 15,
  });
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  const [rows] = await pool.query('SELECT * FROM admin_users WHERE email = ? LIMIT 1', [email]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

  const admin = rows[0];
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = signAccessToken({ type: 'admin', sub: admin.id }, JWT_ADMIN_SECRET);
  const refresh = await issueRefreshToken({ adminId: admin.id });
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refresh.raw, refresh.expiresAt);

  return res.json({
    accessToken,
    refreshToken: USE_COOKIE_REFRESH ? null : refresh.raw,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  });
});

router.post('/refresh', async (req, res) => {
  const incoming = req.cookies?.admin_refresh_token || req.body?.refreshToken;
  if (!incoming) return res.status(400).json({ error: 'Refresh token required' });

  const [tokenRow] = await pool.query(
    'SELECT admin_id FROM refresh_tokens WHERE token_hash = SHA2(?, 256) LIMIT 1',
    [incoming]
  );
  if (!tokenRow.length) return res.status(401).json({ error: 'Invalid token' });

  const rotated = await rotateRefreshToken(incoming, { adminId: tokenRow[0].admin_id });
  if (!rotated) return res.status(401).json({ error: 'Expired token' });

  const accessToken = signAccessToken({ type: 'admin', sub: tokenRow[0].admin_id }, JWT_ADMIN_SECRET);
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, rotated.raw, rotated.expiresAt);

  return res.json({
    accessToken,
    refreshToken: USE_COOKIE_REFRESH ? null : rotated.raw,
  });
});

router.post('/logout', async (req, res) => {
  const incoming = req.cookies?.admin_refresh_token || req.body?.refreshToken;
  if (incoming) await revokeRefreshToken(incoming);
  res.clearCookie('admin_refresh_token');
  res.clearCookie('admin_access_token');
  logAudit({
    actorType: 'admin',
    actorId: null,
    action: 'admin.logout',
    entityType: 'admin',
    entityId: null,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Logged out' });
});

router.get('/me', requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role FROM admin_users WHERE id = ?',
    [req.admin.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  return res.json(rows[0]);
});

export default router;
  logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'admin.login',
    entityType: 'admin',
    entityId: admin.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
