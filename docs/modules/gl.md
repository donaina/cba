# GL Module

**Path**: `modules/gl/`

---

## Key files

| File | Role |
|------|------|
| `gl.service.ts` | COA CRUD, `getSystemAccount()`, `getGlForAccount()`, cache management |
| `posting-engine.ts` | Balance assertion + Serializable DB write |
| `gl.controller.ts` | REST endpoints for COA management |

---

## Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/gl/accounts` | `gl:post` | Create GL account |
| GET | `/gl/accounts` | `gl:read` | List all GL accounts for tenant |
| GET | `/gl/accounts/:id` | `gl:read` | Get single account |
| PATCH | `/gl/accounts/:id` | `gl:post` | Update GL account |

---

## System accounts

GL accounts marked `isSystemAccount = true` with well-known codes are resolved by all
financial services via `GlService.getSystemAccount(code, tenantId)`.

The cache is keyed `{tenantId}:{code}`. Call `glService.clearSystemAccountCache()` after
creating or modifying system accounts.

If a system account is not found:
> `"System account VAULT_CASH not found for tenant X. Run the GL seed script."`

---

## GL hierarchy (DETAIL only accepts postings)

```
CATEGORY → HEADER → SUB_HEADER → DETAIL (postable)
```

Only `DETAIL`-level accounts accept entries from `PostingEngine`.
Higher-level balances are derived by summing descendants.

---

## Trial balance

`GET /reports/trial-balance?from=2025-01-01&to=2025-01-31`

Queries `TransactionEntry` directly — **not** `Account.currentBalance`.
This is the correct accounting approach: balances are derived from the posted-entry ledger.

---

## Adding a new GL account

1. Add to `scripts/seeds/gl.seed.ts` with correct parent code
2. Re-run `npm run seed` (idempotent — skips existing codes)
3. Add to GL Account Code Reference in `CLAUDE.md`
