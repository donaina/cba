# Auth Module

**Path**: `modules/auth/`

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Email + password → access + refresh tokens |
| POST | `/auth/refresh` | Public | Refresh token → new access token |
| POST | `/auth/logout` | JWT | Invalidate current session |
| POST | `/auth/request-password-reset` | Public | Send 6-digit OTP to email |
| POST | `/auth/reset-password` | Public | Validate OTP → set new password |
| POST | `/auth/users` | `user:create` | Create bank user |
| POST | `/auth/roles` | `role:create` | Create role with permission codes |

---

## Token design

**Access token** (JWT, 15 min):
```json
{
  "sub": "userId",
  "tenantId": "orgId",
  "branchId": "branchId",
  "sessionId": "sessionId",
  "permissions": ["loan:approve", "txn:deposit"],
  "iat": 1700000000,
  "exp": 1700000900
}
```

**Refresh token**: 32-byte random hex, stored as SHA-256 hash in `Session.refreshTokenHash`.
Returned to client once — never stored in plaintext.

---

## Session table (not Redis)

Sessions are rows in the `Session` table. Every access-token validation checks
`Session.isActive = true` and `Session.expiresAt > now()`.
Revoked sessions are rejected immediately even if the JWT hasn't expired.

See [ADR-003](../adr/003-session-table-not-redis.md).

---

## Permission codes

```
customer:create   customer:read   customer:update
account:create    account:read    account:close
txn:deposit       txn:withdraw    txn:transfer    txn:approve   txn:reverse
loan:apply        loan:approve    loan:disburse   loan:write-off  loan:read
compliance:read   compliance:alert
audit:read
user:create       role:create
gl:post           gl:read
report:read
admin:read        admin:config
```

---

## Password reset flow

1. `POST /auth/request-password-reset` → 6-digit OTP, stored as SHA-256 hash, 10-min TTL, sent via email (sandbox: logged)
2. `POST /auth/reset-password` → validates OTP hash → bcrypt-hashes new password → invalidates all existing sessions

---

## Guards

- `JwtAuthGuard` — validates token + DB session check on every request
- `PermissionGuard` — reads `@RequirePermission('code')` decorator via Reflector

## Adding a new permission

1. Add to `scripts/seeds/permissions.seed.ts`
2. Add `@RequirePermission('your:code')` to controller method
3. Re-run `npm run seed` — existing roles unaffected; assign via admin UI
