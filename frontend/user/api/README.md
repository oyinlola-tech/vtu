# User API Proxy

The user web app does **not** call `/api/*` directly. It uses the backend proxy base:

```
/app/api
```

All frontend API calls should use the `api()` helper in `frontend/user/api/client.js` which reads:

```
<meta name="api-base" content="/app/api" />
```

## Endpoints (via `/app/api`)
- Auth: `/app/api/auth/*`
- User profile & security: `/app/api/user/*`
- Wallet: `/app/api/wallet/*`
- Bills: `/app/api/bills/*`
- Transactions: `/app/api/transactions/*`
- Banks: `/app/api/banks/*`

Notes:
- `/app/api/auth/*` includes login, register, forgot/reset password, verify-device, refresh, csrf.
- CSRF exemptions are mirrored for `/app/api/*` in the backend.
