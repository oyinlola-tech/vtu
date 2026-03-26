import crypto from 'crypto';

export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function csrfMiddleware(req, res, next) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

  const authHeader = req.headers.authorization;
  if (authHeader) return next();

  const csrfCookie = req.cookies?.csrf_token;
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  return next();
}
