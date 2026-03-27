import crypto from 'crypto';

const DEFAULT_SECRET = process.env.COOKIE_ENC_SECRET || process.env.JWT_SECRET || 'dev_secret_change_me';

function getKey() {
  // Derive a 32-byte key from the configured secret.
  return crypto.createHash('sha256').update(String(DEFAULT_SECRET)).digest();
}

export function encryptCookieValue(value) {
  if (!value) return value;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join('.');
}

export function decryptCookieValue(value) {
  if (!value) return null;
  const parts = String(value).split('.');
  if (parts.length !== 3) return null;
  const [ivB64, ctB64, tagB64] = parts;
  try {
    const key = getKey();
    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (err) {
    return null;
  }
}
