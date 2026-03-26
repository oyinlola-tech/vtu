import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { hashToken, pool } from '../config/db.js';

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_DAYS || 14);

function addDays(days) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

export function signAccessToken(payload, secret) {
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TTL });
}

export async function issueRefreshToken({ userId = null, adminId = null }) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = addDays(REFRESH_TTL_DAYS);
  await pool.query(
    'INSERT INTO refresh_tokens (id, user_id, admin_id, token_hash, expires_at) VALUES (UUID(), ?, ?, ?, ?)',
    [userId, adminId, tokenHash, expiresAt]
  );
  return { raw, expiresAt };
}

export async function revokeRefreshToken(raw) {
  const tokenHash = hashToken(raw);
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?',
    [tokenHash]
  );
}

export async function rotateRefreshToken(raw, { userId = null, adminId = null }) {
  const tokenHash = hashToken(raw);
  const [rows] = await pool.query(
    'SELECT id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = ? LIMIT 1',
    [tokenHash]
  );
  if (!rows.length) return null;
  if (rows[0].revoked_at) return null;
  if (new Date(rows[0].expires_at) < new Date()) return null;

  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [
    tokenHash,
  ]);
  return issueRefreshToken({ userId, adminId });
}
