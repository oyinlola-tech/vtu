import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

const MAX_ATTEMPTS = Number(process.env.PIN_MAX_ATTEMPTS || 5);
const LOCK_MINUTES = Number(process.env.PIN_LOCK_MINUTES || 15);

export function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

export async function getPinStatus(userId) {
  const [[row]] = await pool.query(
    'SELECT transaction_pin_hash, pin_failed_attempts, pin_locked_until, biometric_enabled FROM users WHERE id = ?',
    [userId]
  );
  if (!row) return null;
  return {
    hasPin: Boolean(row.transaction_pin_hash),
    failedAttempts: Number(row.pin_failed_attempts || 0),
    lockedUntil: row.pin_locked_until,
    biometricEnabled: Boolean(row.biometric_enabled),
  };
}

export async function setTransactionPin(userId, pin) {
  const pinHash = await bcrypt.hash(pin, 12);
  await pool.query(
    `UPDATE users
     SET transaction_pin_hash = ?, pin_failed_attempts = 0, pin_locked_until = NULL, pin_updated_at = NOW()
     WHERE id = ?`,
    [pinHash, userId]
  );
}

export async function verifyTransactionPin(userId, pin) {
  const [[row]] = await pool.query(
    'SELECT transaction_pin_hash, pin_failed_attempts, pin_locked_until FROM users WHERE id = ?',
    [userId]
  );
  if (!row?.transaction_pin_hash) {
    const err = new Error('Transaction PIN not set');
    err.code = 'PIN_NOT_SET';
    throw err;
  }
  if (row.pin_locked_until && new Date(row.pin_locked_until).getTime() > Date.now()) {
    const err = new Error('Transaction PIN locked. Try later.');
    err.code = 'PIN_LOCKED';
    err.lockedUntil = row.pin_locked_until;
    throw err;
  }
  const ok = await bcrypt.compare(pin, row.transaction_pin_hash);
  if (!ok) {
    const attempts = Number(row.pin_failed_attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await pool.query(
        'UPDATE users SET pin_failed_attempts = ?, pin_locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
        [attempts, LOCK_MINUTES, userId]
      );
      const err = new Error('Transaction PIN locked due to repeated failures.');
      err.code = 'PIN_LOCKED';
      throw err;
    }
    await pool.query('UPDATE users SET pin_failed_attempts = ? WHERE id = ?', [attempts, userId]);
    const err = new Error('Invalid transaction PIN');
    err.code = 'PIN_INVALID';
    throw err;
  }
  await pool.query('UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = ?', [
    userId,
  ]);
  return true;
}
