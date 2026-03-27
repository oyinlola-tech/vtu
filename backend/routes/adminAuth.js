import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../utils/tokens.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { logAudit } from '../utils/audit.js';
import { createOtp, verifyOtp } from '../utils/otp.js';
import { sendOtpEmail, sendSecurityEmail } from '../utils/email.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { otpLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET || 'dev_secret_change_me';
const USE_COOKIE_REFRESH = (process.env.COOKIE_REFRESH || 'true') === 'true';
const isProd = process.env.NODE_ENV === 'production';

function setRefreshCookie(res, token, expiresAt) {
  if (!USE_COOKIE_REFRESH) return;
  res.cookie('admin_refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    expires: expiresAt,
  });
}

function setAccessCookie(res, token) {
  res.cookie('admin_access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 15,
  });
}

function setCsrfCookie(res, token) {
  res.cookie('csrf_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 6,
  });
}

function issueCsrf(res) {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  return token;
}

router.post('/login', otpLimiter, async (req, res) => {
  /*
    #swagger.tags = ['Admin Auth']
    #swagger.summary = 'Admin login'
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/AuthLoginRequest' } }
    #swagger.responses[200] = { description: 'Logged in', schema: { $ref: '#/definitions/AdminLoginResponse' } }
    #swagger.responses[401] = { description: 'Invalid credentials', schema: { $ref: '#/definitions/ErrorResponse' } }
  */
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
  const csrfToken = issueCsrf(res);
  logAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'admin.login',
    entityType: 'admin',
    entityId: admin.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);

  return res.json({
    accessToken,
    refreshToken: USE_COOKIE_REFRESH ? null : refresh.raw,
    csrfToken,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  });
});

router.post('/refresh', async (req, res) => {
  /*
    #swagger.tags = ['Admin Auth']
    #swagger.summary = 'Refresh admin access token'
    #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/RefreshRequest' } }
    #swagger.responses[200] = { description: 'Tokens refreshed', schema: { $ref: '#/definitions/AuthTokensResponse' } }
  */
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
  const csrfToken = issueCsrf(res);

  return res.json({
    accessToken,
    refreshToken: USE_COOKIE_REFRESH ? null : rotated.raw,
    csrfToken,
  });
});

router.post('/logout', requireAdmin, async (req, res) => {
  /*
    #swagger.tags = ['Admin Auth']
    #swagger.summary = 'Admin logout'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/RefreshRequest' } }
    #swagger.responses[200] = { description: 'Logged out', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const incoming = req.cookies?.admin_refresh_token || req.body?.refreshToken;
  if (incoming) await revokeRefreshToken(incoming);
  res.clearCookie('admin_refresh_token');
  res.clearCookie('admin_access_token');
  res.clearCookie('csrf_token');
  logAudit({
    actorType: 'admin',
    actorId: req.admin?.sub || null,
    action: 'admin.logout',
    entityType: 'admin',
    entityId: req.admin?.sub || null,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Logged out' });
});

router.get('/me', requireAdmin, async (req, res) => {
  /*
    #swagger.tags = ['Admin Auth']
    #swagger.summary = 'Get current admin profile'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'Admin',
      schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } }
    }
  */
  const [rows] = await pool.query(
    'SELECT id, name, email, role FROM admin_users WHERE id = ?',
    [req.admin.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  return res.json(rows[0]);
});

router.post('/forgot-password', otpLimiter, async (req, res) => {
  /*
    #swagger.tags = ['Admin Auth']
    #swagger.summary = 'Request admin password reset OTP'
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/ForgotPasswordRequest' } }
    #swagger.responses[200] = { description: 'OTP dispatched', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  const [rows] = await pool.query('SELECT id FROM admin_users WHERE email = ? LIMIT 1', [email]);
  if (!rows.length) return res.json({ message: 'OTP sent if account exists' });
  try {
    const { code } = await createOtp({
      userId: rows[0].id,
      email,
      purpose: 'admin_password_reset',
    });
    await sendOtpEmail({ to: email, code, purpose: 'password_reset' });
    logAudit({
      actorType: 'admin',
      actorId: rows[0].id,
      action: 'admin.password_reset.requested',
      entityType: 'admin',
      entityId: rows[0].id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(console.error);
  } catch (err) {
    if (err.code === 'OTP_COOLDOWN' || err.code === 'OTP_LIMIT') {
      return res.status(429).json({ error: 'Too many OTP requests. Try later.' });
    }
    throw err;
  }
  return res.json({ message: 'OTP sent if account exists' });
});

router.post('/reset-password', async (req, res) => {
  /*
    #swagger.tags = ['Admin Auth']
    #swagger.summary = 'Reset admin password using OTP'
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/ResetPasswordRequest' } }
    #swagger.responses[200] = { description: 'Password reset', schema: { $ref: '#/definitions/MessageResponse' } }
  */
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password too short' });
  }
  const otp = await verifyOtp({ email, purpose: 'admin_password_reset', code });
  if (!otp) return res.status(400).json({ error: 'Invalid or expired OTP' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE admin_users SET password_hash = ? WHERE email = ?', [
    passwordHash,
    email,
  ]);
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE admin_id = ?', [
    otp.user_id,
  ]);
  sendSecurityEmail({
    to: email,
    title: 'Admin Password Updated',
    message: 'Your admin password was changed successfully.',
  }).catch(console.error);
  logAudit({
    actorType: 'admin',
    actorId: otp.user_id,
    action: 'admin.password_reset',
    entityType: 'admin',
    entityId: otp.user_id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Password reset successful' });
});

router.get('/csrf', (req, res) => {
  /*
    #swagger.tags = ['Admin Auth']
    #swagger.summary = 'Get CSRF token for admin session'
    #swagger.responses[200] = {
      description: 'CSRF token',
      schema: { type: 'object', properties: { csrfToken: { type: 'string' } } }
    }
  */
  const token = issueCsrf(res);
  return res.json({ csrfToken: token });
});

export default router;
