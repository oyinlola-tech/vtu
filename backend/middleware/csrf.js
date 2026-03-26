import crypto from 'crypto';

export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function csrfMiddleware(req, res, next) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

  const csrfExemptPaths = [
    '/api/monnify/webhook',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/verify-device',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/refresh',
    '/api/auth/csrf',
    '/api/admin/auth/login',
    '/api/admin/auth/forgot-password',
    '/api/admin/auth/reset-password',
    '/api/admin/auth/refresh',
    '/api/admin/auth/csrf',
  ];
  if (csrfExemptPaths.some((p) => req.path?.startsWith(p))) return next();

  const authHeader = req.headers.authorization;
  if (authHeader) return next();

  const csrfCookie = req.cookies?.csrf_token;
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  return next();
}
