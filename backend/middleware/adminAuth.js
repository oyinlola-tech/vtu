import jwt from 'jsonwebtoken';

const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET || 'dev_secret_change_me';

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearer || req.cookies?.admin_access_token;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_ADMIN_SECRET);
    if (payload.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.admin = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
