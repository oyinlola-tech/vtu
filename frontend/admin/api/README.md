# Admin API Proxy

The admin web app does **not** call `/api/admin/*` directly. It uses the backend proxy base:

```
/app/admin/api
```

All frontend API calls should use the `api()` helper in `frontend/admin/api/client.js` which reads:

```
<meta name="api-base" content="/app/admin/api" />
```

## Endpoints (via `/app/admin/api`)
- Admin auth: `/app/admin/api/auth/*`
- Users: `/app/admin/api/users/*`
- Bills: `/app/admin/api/bills/*`
- Transactions: `/app/admin/api/transactions/*`
- Management: `/app/admin/api/manage/*`
- Audit: `/app/admin/api/audit/*`
- Finance: `/app/admin/api/finance/*`
- Monnify: `/app/admin/api/monnify/*`
