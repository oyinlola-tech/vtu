const rolePermissions = {
  superadmin: ['*'],
  operations: ['users:read', 'users:kyc', 'transactions:read', 'bills:read', 'bills:write'],
  support: ['users:read', 'users:kyc'],
  finance: ['transactions:read', 'pricing:read', 'pricing:write', 'bills:read', 'finance:read'],
  compliance: ['audit:read', 'users:read'],
};

export function requirePermission(permission) {
  return (req, res, next) => {
    const role = req.admin?.role || 'support';
    const allowed = rolePermissions[role] || [];
    if (allowed.includes('*') || allowed.includes(permission)) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

export { rolePermissions };
