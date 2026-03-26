# Security Policy

## Overview
GLY VTU is a private, security‑sensitive fintech platform. All security issues must be handled confidentially.

## Reporting a Vulnerability
If you discover a vulnerability:
1. **Do not disclose publicly.**
2. Provide a clear report with steps to reproduce and impact.
3. Send the report to the project owner for review and remediation.

## Scope
In scope:
- Authentication, authorization, and OTP flows
- Admin role management and permissions
- Payment and webhook processing
- Data storage and exposure
- API abuse, rate limits, and audit logging

Out of scope:
- Social engineering
- Physical security

## Response Targets
We aim to:
- Acknowledge within 48 hours
- Triage within 5 business days
- Patch critical issues within 14 days when feasible

## Secure Development Practices
Baseline controls in this project:
- JWT access tokens + refresh tokens
- OTP rate limits
- Device verification for unknown logins
- Audit logs for sensitive events
- Role‑based access control (RBAC)
- Webhook signature verification (when configured)

## Disclosure Policy
All disclosures require explicit permission from the owner (see `LICENSE`).

