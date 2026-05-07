# Multi-Tenancy Design

## Approach: Shared database, shared schema, row-level isolation

Every business data table has a `tenantId` column. All queries are filtered by `tenantId`
at the service layer. This is the simplest multi-tenancy approach — one migration applies to
all tenants simultaneously.

---

## TenantContext — the central primitive

`TenantContext` is a **request-scoped** NestJS provider populated once per request by
`TenantMiddleware` from the validated JWT payload.

```typescript
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  tenantId:  string;
  userId:    string;
  branchId:  string;
  sessionId: string;
}
```

Every service that touches the database injects `TenantContext` and passes
`this.ctx.tenantId` into every Prisma query. This is non-negotiable.

---

## Where tenantId is enforced

### Reads — returns 404 (not 403) on mismatch to prevent enumeration attacks
```typescript
await prisma.account.findUnique({
  where: { id: accountId, tenantId: this.ctx.tenantId },
});
```

### Writes — always set from context, never from user input
```typescript
await prisma.account.create({
  data: { tenantId: this.ctx.tenantId, ...rest },
});
```

---

## Tenant lifecycle

```
1. Organisation created (tenantId = organisation.id)
2. GL chart of accounts seeded
3. Transaction types seeded
4. Branch created (HEAD_OFFICE)
5. Users created and assigned roles + branch access
6. Products created
7. Logo uploaded (optional branding)
8. Customers onboarded → accounts opened
```

Deactivating a tenant (`Organisation.isActive = false`) blocks all logins.
Data is retained indefinitely for regulatory purposes.

---

## Tenant resolution flow

```
Incoming request
     │
     ▼
JwtAuthGuard validates token
     ├─ token.tenantId → Organisation.id
     ├─ token.userId   → User.id
     ├─ token.branchId → Branch.id
     └─ token.sessionId → Session.id (validated in DB)
     │
     ▼
TenantMiddleware copies into TenantContext (request-scoped)
     │
     ▼
All downstream services read from TenantContext
```

---

## Branch access control

Users are assigned branch access via `UserBranchAccess`:

| Access type | Meaning |
|-------------|---------|
| `ALL_BRANCHES` | Can operate for any branch of their tenant |
| Specific branch IDs | Can only serve customers of those branches |

`canApprove` flag on `UserBranchAccess` controls whether the user can act as checker
in maker-checker workflows for that branch.

---

## Performance — indexes must lead with tenantId

```sql
-- Good: index starts with tenantId
CREATE INDEX idx_account_tenant_customer ON "Account" ("tenantId", "customerId");

-- Bad: index starts with non-tenant column → full scan across all tenants
CREATE INDEX idx_account_customer ON "Account" ("customerId");
```

All Prisma schema indexes use `@@index([tenantId, ...])`.

---

## Future: Separate schemas or databases per tenant

If a high-volume tenant needs stronger isolation:
1. Export all rows where `tenantId = X` to a separate database
2. Add `databaseUrl` override to `Organisation`
3. Add a `TenantDatabaseResolver` that swaps the Prisma client per request

Current architecture supports thousands of tenants on a single well-resourced PostgreSQL instance.
