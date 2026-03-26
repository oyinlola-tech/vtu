import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminAuthLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_ADMIN_AUTH_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
});
