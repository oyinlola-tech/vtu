import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../utils/tokens.js';
import { createOtp, verifyOtp } from '../utils/otp.js';
import { sendOtpEmail, sendWelcomeEmail, sendSecurityEmail, sendLoginFailedEmail } from '../utils/email.js';
import { createReservedAccount } from '../utils/monnify.js';
import { logAudit } from '../utils/audit.js';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const USE_COOKIE_REFRESH = (process.env.COOKIE_REFRESH || 'true') === 'true';

function setRefreshCookie(res, token, expiresAt) {
  if (!USE_COOKIE_REFRESH) return;
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    expires: expiresAt,
  });
}

function setAccessCookie(res, token) {
  res.cookie('access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 15,
  });
}

router.post('/register', async (req, res) => {
  const { fullName, email, phone, password, bvn, nin } = req.body || {};
  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!bvn && !nin) {
    return res.status(400).json({ error: 'BVN or NIN is required' });
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [
    email,
    phone,
  ]);
  if (existing.length) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = crypto.randomUUID();
  try {
    await pool.query(
      'INSERT INTO users (id, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
      [userId, fullName, email, phone, passwordHash]
    );
    await pool.query('INSERT INTO wallets (id, user_id, balance, currency) VALUES (UUID(), ?, 0, ?)', [
      userId,
      'NGN',
    ]);

    const accountReference = `GLY-${userId}`;
    const accountName = fullName;
    const reserved = await createReservedAccount({
      accountReference,
      accountName,
      customerName: fullName,
      customerEmail: email,
      bvn,
      nin,
    });

    const account = reserved?.accounts?.[0] || {};
    await pool.query(
      `INSERT INTO reserved_accounts
       (id, user_id, provider, account_reference, reservation_reference, account_name, account_number, bank_name, bank_code, status, raw_response)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'monnify',
        accountReference,
        reserved?.reservationReference || null,
        reserved?.accountName || accountName,
        account.accountNumber || reserved?.accountNumber || '',
        account.bankName || reserved?.bankName || '',
        account.bankCode || null,
        reserved?.status || 'ACTIVE',
        JSON.stringify(reserved || {}),
      ]
    );

    sendWelcomeEmail({
      to: email,
      name: fullName,
      accountNumber: account.accountNumber || reserved?.accountNumber,
      bankName: account.bankName || reserved?.bankName,
    }).catch(console.error);
    logAudit({
      actorType: 'user',
      actorId: userId,
      action: 'user.register',
      entityType: 'user',
      entityId: userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(console.error);
    return res.status(201).json({ message: 'Registered successfully' });
  } catch (err) {
    await pool.query('DELETE FROM wallets WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    return res.status(500).json({ error: 'Account creation failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password, deviceId } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    sendLoginFailedEmail({
      to: user.email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(console.error);
    logAudit({
      actorType: 'user',
      actorId: user.id,
      action: 'login.failed',
      entityType: 'user',
      entityId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(console.error);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const [devices] = await pool.query(
    'SELECT id FROM user_devices WHERE user_id = ? AND device_id = ? LIMIT 1',
    [user.id, deviceId || '']
  );
  if (!devices.length) {
    try {
      const { code } = await createOtp({
        userId: user.id,
        email,
        purpose: 'device_login',
      });
      await sendOtpEmail({ to: email, code, purpose: 'device_login' });
      logAudit({
        actorType: 'user',
        actorId: user.id,
        action: 'otp.device_login.requested',
        entityType: 'user',
        entityId: user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(console.error);
      return res.json({ otpRequired: true, message: 'OTP sent to email' });
    } catch (err) {
      if (err.code === 'OTP_COOLDOWN' || err.code === 'OTP_LIMIT') {
        return res.status(429).json({ error: 'Too many OTP requests. Try later.' });
      }
      throw err;
    }
  }

  await pool.query(
    'UPDATE user_devices SET last_seen = NOW(), ip_address = ?, user_agent = ? WHERE user_id = ? AND device_id = ?',
    [req.ip, req.headers['user-agent'] || null, user.id, deviceId]
  );

  const accessToken = signAccessToken({ type: 'user', sub: user.id }, JWT_SECRET);
  const refresh = await issueRefreshToken({ userId: user.id });
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refresh.raw, refresh.expiresAt);

  return res.json({
    accessToken,
    refreshToken: USE_COOKIE_REFRESH ? null : refresh.raw,
    user: { id: user.id, fullName: user.full_name, email: user.email, phone: user.phone },
  });
});

router.post('/verify-device', async (req, res) => {
  const { email, code, deviceId, label } = req.body || {};
  if (!email || !code || !deviceId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const otp = await verifyOtp({ email, purpose: 'device_login', code });
  if (!otp) return res.status(400).json({ error: 'Invalid or expired OTP' });

  const [rows] = await pool.query('SELECT id, full_name, email, phone FROM users WHERE id = ?', [
    otp.user_id,
  ]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  const user = rows[0];

  await pool.query(
    `INSERT INTO user_devices (id, user_id, device_id, label, ip_address, user_agent)
     VALUES (UUID(), ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE last_seen = NOW(), ip_address = VALUES(ip_address), user_agent = VALUES(user_agent)`,
    [user.id, deviceId, label || null, req.ip, req.headers['user-agent'] || null]
  );

  const accessToken = signAccessToken({ type: 'user', sub: user.id }, JWT_SECRET);
  const refresh = await issueRefreshToken({ userId: user.id });
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refresh.raw, refresh.expiresAt);

  sendSecurityEmail({
    to: user.email,
    title: 'New Device Verified',
    message: `A new device was verified for your account. If this wasn’t you, reset your password immediately.`,
  }).catch(console.error);

  logAudit({
    actorType: 'user',
    actorId: user.id,
    action: 'device.verified',
    entityType: 'device',
    entityId: deviceId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);

  return res.json({
    accessToken,
    refreshToken: USE_COOKIE_REFRESH ? null : refresh.raw,
    user,
  });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (!rows.length) return res.json({ message: 'OTP sent if account exists' });

  try {
    const { code } = await createOtp({
      userId: rows[0].id,
      email,
      purpose: 'password_reset',
    });
    await sendOtpEmail({ to: email, code, purpose: 'password_reset' });
    logAudit({
      actorType: 'user',
      actorId: rows[0].id,
      action: 'otp.password_reset.requested',
      entityType: 'user',
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
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const otp = await verifyOtp({ email, purpose: 'password_reset', code });
  if (!otp) return res.status(400).json({ error: 'Invalid or expired OTP' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, otp.user_id]);
  sendSecurityEmail({
    to: email,
    title: 'Password Updated',
    message: 'Your GLY VTU password was changed successfully.',
  }).catch(console.error);
  logAudit({
    actorType: 'user',
    actorId: otp.user_id,
    action: 'user.password_reset',
    entityType: 'user',
    entityId: otp.user_id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch(console.error);
  return res.json({ message: 'Password reset successful' });
});

router.post('/refresh', async (req, res) => {
  const incoming = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!incoming) return res.status(400).json({ error: 'Refresh token required' });

  const [tokenRow] = await pool.query(
    'SELECT user_id FROM refresh_tokens WHERE token_hash = SHA2(?, 256) LIMIT 1',
    [incoming]
  );
  if (!tokenRow.length) return res.status(401).json({ error: 'Invalid token' });

  const rotated = await rotateRefreshToken(incoming, { userId: tokenRow[0].user_id });
  if (!rotated) return res.status(401).json({ error: 'Expired token' });

  const accessToken = signAccessToken({ type: 'user', sub: tokenRow[0].user_id }, JWT_SECRET);
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, rotated.raw, rotated.expiresAt);

  return res.json({
    accessToken,
    refreshToken: USE_COOKIE_REFRESH ? null : rotated.raw,
  });
});

router.post('/logout', async (req, res) => {
  const incoming = req.cookies?.refresh_token || req.body?.refreshToken;
  if (incoming) await revokeRefreshToken(incoming);
  res.clearCookie('refresh_token');
  res.clearCookie('access_token');
  return res.json({ message: 'Logged out' });
});

router.get('/me', requireUser, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, phone, kyc_level, kyc_status FROM users WHERE id = ?',
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  return res.json(rows[0]);
});

export default router;
