# System Architecture Overview

## What this system is

A multi-tenant core banking application (CBA) for CBN-regulated Nigerian financial institutions.
Single NestJS deployable — a **modular monolith** — sharing one PostgreSQL database with
row-level tenant isolation.

---

## Why a modular monolith (not microservices)

See [ADR-001](../adr/001-monolith-vs-microservices.md) for the full decision.

Banking operations require strong transactional consistency. Distributed transactions
across microservices add complexity that is hard to reason about when the cost of a mistake
is financial loss. A monolith with clean module boundaries gives the same codebase organisation
as microservices, with the simplicity of a single transaction boundary.

---

## High-level component diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          NestJS Application                          │
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │   Auth   │  │Customers │  │ Accounts │  │     Transactions     │ │
│  │  Module  │  │  + KYC   │  │ Savings  │  │  Deposit/Withdraw    │ │
│  └──────────┘  └──────────┘  │ Current  │  │  Intra/Inter-bank   │ │
│                               │    FD    │  │  Maker-Checker       │ │
│  ┌──────────┐  ┌──────────┐  └──────────┘  └──────────────────────┘ │
│  │  Loans   │  │    GL    │                                          │
│  │ Lifecycle│  │ Posting  │  ┌──────────┐  ┌──────────────────────┐ │
│  │ EOD Job  │  │  Engine  │  │  NIBSS   │  │     Notifications    │ │
│  └──────────┘  └──────────┘  │   NIP    │  │  RabbitMQ consumer   │ │
│                               └──────────┘  │  SMS / Email / App   │ │
│  ┌──────────┐  ┌──────────┐                 └──────────────────────┘ │
│  │ Reports  │  │   AML    │  ┌──────────┐  ┌──────────────────────┐ │
│  │ PDF/Stmt │  │ Watchdog │  │  Admin   │  │        BaaS          │ │
│  └──────────┘  └──────────┘  │ +Branding│  │  API Keys/Webhooks   │ │
│                               └──────────┘  └──────────────────────┘ │
└───────────────────────────────────────────────┬─────────────────────┘
                                                 │
              ┌──────────────┬──────────────────┬┴──────────────┐
              │              │                  │               │
         PostgreSQL      RabbitMQ            MinIO          External APIs
         (Prisma ORM)  (Notifications)  (Docs/Statements  (NIBSS, CRC,
                                          /Logo/Branding)  Termii, SendGrid)
```

---

## Request lifecycle

```
Client Request
     │
     ▼
ThrottlerGuard (200 req/min per IP)
     │
     ▼
TenantMiddleware (copies JWT claims → TenantContext, request-scoped)
     │
     ▼
IdempotencyMiddleware (POST on financial routes — check/cache by Idempotency-Key)
     │
     ▼
JwtAuthGuard (validates token + checks Session row in DB)
     │
     ▼
PermissionGuard (checks @RequirePermission vs JWT permissions array)
     │
     ▼
Controller → Service → Repository
     │                     │
     │              Prisma.$transaction (Serializable isolation)
     │                     │
     │              PostingEngine (balance assertion → GL entries)
     │
     ▼
AuditLogInterceptor (logs mutation, redacts sensitive fields)
     │
     ▼
Response → Client
```

---

## Data flow for an OTC deposit

```
POST /transactions/deposit
  │
  ├─ TransactionService.otcDeposit()
  │    ├─ Load & validate account (tenantId, status, frozen check)
  │    ├─ FeeCalculator.calculate() → baseFee + VAT + WHT
  │    ├─ MakerCheckerService.requiresApproval()? → PENDING_APPROVAL if yes
  │    └─ PostingEngine.post()
  │         ├─ Assert SUM(debit) === SUM(credit)
  │         └─ prisma.$transaction(Serializable)
  │              ├─ TransactionRecord.create (COMPLETED)
  │              ├─ TransactionEntry.createMany (DR VAULT_CASH, CR SAVINGS_CONTROL)
  │              └─ Account.update (currentBalance += amount)
  │
  └─ AmlPublisher.screenLargeTransaction() [fire-and-forget if ≥ ₦5M]
```

---

## EOD batch jobs

| Job | Schedule | Timezone | What it does |
|-----|----------|----------|-------------|
| `LoanEodJob` | 22:00 daily | Africa/Lagos (WAT) | Accrues overdue penalties; re-classifies all active/overdue loans |
| `FdMaturityJob` | 23:00 daily | Africa/Lagos (WAT) | Matures eligible FDs; pays periodic interest schedules |

Both jobs iterate over all active tenants and are idempotent — safe to re-run.

---

## Security layers

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS (TLS at load balancer / nginx) |
| Headers | Helmet middleware (CSP, HSTS, X-Frame-Options) |
| Authentication | JWT (15-min access token) + DB-stored refresh token (7 days, hashed) |
| Authorisation | Granular permission codes (`loan:approve`, `compliance:alert`, etc.) |
| Rate limiting | ThrottlerGuard — 200 requests/minute per IP |
| Idempotency | 24-hour key cache prevents duplicate financial operations |
| Tenant isolation | Every query filtered by `tenantId` from TenantContext |
| Audit trail | All mutations logged to `AuditLog` with sensitive fields redacted |
| Webhook security | HMAC-SHA256 signature + 5-min timestamp replay protection |
| AML webhook | Shared secret HMAC + timestamp validation |
