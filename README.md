# GLY VTU

GLY VTU is a Nigeria-focused fintech platform for bill payments, wallet transfers, KYC, and virtual account funding. It ships with user and admin interfaces, a Node.js API, MySQL persistence, OTP security flows, audit logs, and Monnify reserved accounts.

## Owner
- **Owner:** Oluwayemi Oyinlola Michael  
- **Portfolio:** oyinlola.site  
- **Tech Firm:** telente.site  

## Features
- User and admin web apps (responsive for mobile/tablet/desktop)
- JWT + refresh tokens with device verification OTP
- Admin role management and permissions
- Audit logs with filters
- Financial dashboard and exports (CSV/PDF)
- Monnify reserved accounts + webhook auto-credit
- Email notifications (welcome, OTP, receipts, security alerts)

## Tech Stack
- **Backend:** Node.js, Express, MySQL (AMpps compatible)
- **Auth:** JWT + refresh tokens, OTP, device trust
- **Email:** Nodemailer + PDF receipts
- **Frontend:** HTML, CSS, vanilla JS (modular)

## Project Structure
```
backend/
  config/
  middleware/
  routes/
  utils/
frontend/
  user/
  admin/
server.js
package.json
```

## Getting Started
### 1) Install dependencies
```
npm install
```

### 2) Configure environment
Copy `.env.example` to `.env` and fill required values. In development you can run without a database or secrets (UI-only mode) and optionally bypass auth (see below).

Key settings:
- DB_* (MySQL connection)
- JWT_SECRET / JWT_ADMIN_SECRET
- SMTP_* (email)
- MONNIFY_* (reserved accounts + webhook)

### 3) Run locally
```
npm run dev
```

Default:
- User: `http://localhost:3000/splash`
- Admin: `http://localhost:3000/admin/splash`

### Development helpers
- **UI-only mode:** if the database is unavailable, the server boots the UI and exposes `/dev-status` with `dbReady=false`.
- **Auth bypass:** on localhost only, append `?dev=true` to any protected page URL to skip login checks (e.g., `http://localhost:3000/dashboard?dev=true`).

## Environment Variables (Core)
| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | User auth secret |
| `JWT_ADMIN_SECRET` | Admin auth secret |
| `SMTP_HOST` | SMTP server |
| `EMAIL_FROM` | Sender email |
| `MONNIFY_API_KEY` | Monnify API key |
| `MONNIFY_SECRET_KEY` | Monnify secret |
| `MONNIFY_CONTRACT_CODE` | Monnify contract |
| `MONNIFY_WEBHOOK_SECRET` | Webhook signature secret |
| `MONNIFY_WEBHOOK_IPS` | Comma-separated IP allowlist |

## Key API Endpoints (User)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create user (optional BVN/NIN) |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/verify-device` | OTP device verification |
| POST | `/api/auth/forgot-password` | OTP for reset |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/user/profile` | User profile |
| PUT | `/api/user/kyc` | KYC submission |
| GET | `/api/wallet/balance` | Wallet balance |
| POST | `/api/wallet/send` | Send money |
| POST | `/api/bills/pay` | Pay bills |

## Key API Endpoints (Admin)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/auth/login` | Admin login |
| POST | `/api/admin/auth/forgot-password` | Admin reset OTP |
| POST | `/api/admin/auth/reset-password` | Admin reset |
| GET | `/api/admin/manage` | Admin list |
| POST | `/api/admin/manage` | Create admin |
| PUT | `/api/admin/manage/:id/role` | Update role |
| GET | `/api/admin/audit` | Audit logs (filters) |
| GET | `/api/admin/finance/overview` | Finance dashboard |
| GET | `/api/admin/finance/export` | CSV/PDF export |

## Help & Legal Pages (User)
User-facing help and legal content is available at:
- `/faq`
- `/support`
- `/terms`
- `/privacy`

## Security Question Usage
Security questions are **optional** and are used as an **alternative to OTP during login** (device verification). They are not required for transfers or PIN changes.

## Monnify Webhook
Set the webhook URL in Monnify:
```
POST /api/monnify/webhook
```

The webhook:
- Verifies signature (if configured)
- Deduplicates by payment reference
- Credits user wallet
- Logs audit + sends receipt

## Security Notes
See `SECURITY.md` for security practices and reporting.

## License
This project is **private**. See `LICENSE`.
