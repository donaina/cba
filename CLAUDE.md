# CLAUDE.md — Core Banking Application

This file is read by AI coding assistants (Claude Code, Copilot, etc.) before touching any code.
These rules are non-negotiable. Violating them can cause financial data corruption,
regulatory breaches, or security vulnerabilities.

---

## Non-Negotiable Rules

### 1. Money is always Decimal.js — never native floats

```typescript
// ✅ CORRECT
import { Decimal } from 'decimal.js';
const fee = new Decimal('1075').times('0.075');

// ❌ WRONG — floating-point error will corrupt GL balances
const fee = 1075 * 0.075;
```

Every monetary value is either:
- A `Decimal` in memory
- A `Decimal(20,4)` column in PostgreSQL (stored as string via Prisma)

Never use `Number()`, `parseFloat()`, or arithmetic operators on money values.

### 2. Every GL posting must balance (debits === credits)

The `PostingEngine.post()` method throws `'Journal does not balance'` if entries
don't balance before any database write. Never bypass this check.

```typescript
// SUM(DEBIT entries) === SUM(CREDIT entries) always
```

Never call `prisma.transactionEntry.create()` directly. Always go through `PostingEngine`.

### 3. All DB writes touching money use Serializable isolation

```typescript
await this.prisma.$transaction(async (tx) => {
  // your writes here
}, { isolationLevel: 'Serializable' });
```

Never downgrade to ReadCommitted for any operation touching `Account.currentBalance`
or `TransactionEntry`.

### 4. Every table has tenantId — always filter by it

```typescript
// ✅ CORRECT
await prisma.account.findUnique({ where: { id, tenantId: ctx.tenantId } });

// ❌ WRONG — cross-tenant data leak
await prisma.account.findUnique({ where: { id } });
```

`TenantContext` (request-scoped) provides `tenantId`, `userId`, `branchId`, `sessionId`.
Always inject and use it. Never hard-code a tenantId.

### 5. Repayment waterfall is fixed — Penalty → Interest → Principal

CBN-mandated. Never change the order. See `LoanService.repay()`.

### 6. NUBAN check digit must be validated on every account number input

Use `NubanUtil.validate(bankCode, accountNumber)` before any inter-bank transfer.
Account numbers that fail NUBAN validation must be rejected before reaching NIBSS.

### 7. Maker-checker: the approver cannot be the initiator

`MakerCheckerService.approve()` enforces `initiatedBy !== approvedBy`.
Never skip this check, even in tests or seed scripts.

### 8. Sensitive fields are never logged

`AuditLogInterceptor` redacts: `password`, `pin`, `otp`, `bvn`, `nin`,
`cardNumber`, `cvv`, `refreshToken`. Never add logging that exposes these.

### 9. Idempotency keys are enforced on all financial endpoints

`IdempotencyMiddleware` caches responses by `Idempotency-Key` header for 24 hours.
Financial endpoints (deposits, withdrawals, transfers, loan repayments) must be
wrapped with this middleware. Never remove it from these routes.

### 10. EOD jobs are idempotent

`LoanEodJob` and `FdMaturityJob` check the record's current status before processing.
Never remove these status checks — jobs run nightly and must be safe to re-run.

### 11. Logo in PDFs must be base64, not a URL

Puppeteer (headless Chrome) cannot authenticate against MinIO presigned URLs during
PDF rendering. Always call `BrandingService.getLogoAsDataUri()` which fetches the image
server-side and returns a `data:image/png;base64,...` string for inline embedding.
Never pass a presigned URL directly into the HTML template.

---

## Module Map

```
modules/auth/                → JWT login, session management, RBAC guards
modules/customers/           → Customer CRUD, KYC status
modules/kyc/                 → BVN verification (NIBSS), credit bureau (CRC)
modules/accounts/
  savings/                   → Savings account lifecycle
  current/                   → Current account, overdraft
  fixed-deposit/             → FD open, liquidate, mature (FdMaturityJob @ 23:00 WAT)
modules/loans/               → Apply, approve, disburse, repay, classify (LoanEodJob @ 22:00 WAT)
modules/transactions/        → OTC deposit/withdrawal, intra-transfer, NIP transfer, maker-checker
modules/gl/                  → PostingEngine, COA management, GlService (system account cache)
modules/nibss/               → NIP name enquiry, outward/inward credit, suspense pattern
modules/notifications/       → RabbitMQ consumer → SMS (Termii) / email (SendGrid) / in-app
modules/reports/             → Statement, trial balance, loan portfolio, PDF (Puppeteer)
modules/documents/           → MinIO upload, KYC document store, presigned URLs
modules/aml/                 → Screening publisher, webhook callback, freeze, STR
modules/baas/                → API keys (SHA-256 hashed), webhooks (HMAC-SHA256)
modules/admin/               → Products, rate bands, transaction types, tax rates, branding/logo
modules/audit/               → AuditLog query endpoint
modules/health/              → /health, /health/ready, /health/live
libs/common/                 → TenantContext, AmortizationUtil, NubanUtil, interceptors
libs/database/               → PrismaService (@Global)
```

---

## Third-Party Integrations

| Service | Purpose | Sandbox env var | Notes |
|---------|---------|-----------------|-------|
| NIBSS NIP | Inter-bank transfers, BVN verification | `NIBSS_SANDBOX=true` | Requires NIBSS institution cert in prod |
| Termii | SMS notifications | `TERMII_SANDBOX=true` | Use NG DND-exempt sender ID |
| SendGrid | Email notifications | `SENDGRID_SANDBOX=true` | Verify sender domain |
| CRC | Credit bureau reports | `CREDIT_BUREAU_SANDBOX=true` | Requires CRC subscriber agreement |
| MinIO | Document + statement + logo storage | Local Docker | AWS S3 in prod (same SDK) |
| RabbitMQ | Async notifications, dead-letter | Local Docker | CloudAMQP or self-hosted in prod |
| Puppeteer | PDF statement + FD certificate generation | — | `PUPPETEER_EXECUTABLE_PATH` → Chromium |
| AML vendor | Transaction/customer screening | `AML_WEBHOOK_SECRET` | HMAC-SHA256 callback verification |

All sandbox modes log the outbound payload instead of making real API calls.

---

## CBN Compliance Checklist

| Rule | Where enforced |
|------|---------------|
| KYC Tier 1: BVN + photo, max balance ₦300k | `CustomerService.checkAndUpgradeKycTier()` |
| KYC Tier 2: BVN + NIN + photo, max ₦500k | Same |
| KYC Tier 3: Full docs, unlimited | Same |
| NUBAN 10-digit check digit (weights [3,7,3,3,7,3,3,7,3]) | `NubanUtil.validate()` |
| NIP fee tiers: ≤5k→₦10.75, ≤50k→₦26.88, >50k→₦53.75 | `FeeCalculator` + NIP_TRANSFER config |
| Repayment waterfall: Penalty → Interest → Principal | `LoanService.repay()` |
| CBN DPD classification: 0-89 PERFORMING … 360+ LOST | `LoanService.classifyLoan()` |
| IFRS 9 provision rates: 1%/5%/25%/50%/100% | `LoanService.classifyLoan()` |
| Simple/flat interest P×r×t/365 | `FixedDepositService.calculateInterest()` |
| CTR threshold ₦5,000,000 → file report | `NibssService.fileCtr()`, `AmlPublisher` |
| WHT 10% on FD interest | `FixedDepositService` (DEFAULT_WHT_RATE = 0.10) |
| VAT 7.5% on fees | `FeeCalculator` (vatApplicable flag per transaction type) |
| Penal rate 5% above contract rate | `LoanService` (PENAL_RATE_PA = 0.05) |
| Maker ≠ Checker | `MakerCheckerService.approve()` |

---

## GL Account Code Reference

| Code | Type | Purpose |
|------|------|---------|
| `VAULT_CASH` | ASSET | Physical cash at vault |
| `TELLER_CASH` | ASSET | Cash at teller stations |
| `NIBSS_SETTLEMENT` | ASSET | Settled NIP inward credits |
| `NIBSS_SUSPENSE` | ASSET | In-flight NIP outward debits |
| `LOAN_PORTFOLIO` | ASSET | Outstanding loan principal |
| `LOAN_LOSS_PROVISION` | ASSET (contra) | IFRS 9 provision balance |
| `PREPAYMENTS` | ASSET | Upfront FD interest paid |
| `SAVINGS_CONTROL` | LIABILITY | Aggregate savings balances |
| `CURRENT_CONTROL` | LIABILITY | Aggregate current balances |
| `FIXED_DEPOSIT_CONTROL` | LIABILITY | Aggregate FD balances |
| `VAT_PAYABLE` | LIABILITY | VAT collected, due to FIRS |
| `WHT_PAYABLE` | LIABILITY | WHT deducted, due to FIRS |
| `SHARE_CAPITAL` | EQUITY | Paid-up capital |
| `RETAINED_EARNINGS` | EQUITY | Accumulated profit |
| `INTEREST_INCOME` | INCOME | Savings/current loan interest earned |
| `FD_INTEREST_INCOME` | INCOME | Fixed deposit interest earned |
| `FEE_INCOME` | INCOME | Transaction and service fees |
| `NIP_FEE_INCOME` | INCOME | NIP transfer fee income |
| `PENALTY_INCOME` | INCOME | Loan overdue penalties |
| `ACCOUNT_MAINTENANCE` | INCOME | Monthly maintenance charges |
| `BAD_DEBT_EXPENSE` | EXPENSE | Written-off loan losses |
| `PROVISION_EXPENSE` | EXPENSE | IFRS 9 provision movements |
| `SAVINGS_INTEREST_EXP` | EXPENSE | Interest paid on savings |
| `FD_INTEREST_EXP` | EXPENSE | Interest paid on FDs |

---

## Common Gotchas

**FD same-day liquidation** is blocked (`daysHeld < 1` → `BadRequestException`).

**FD upfront interest liquidation**: the penalty claws back un-earned days of the already-paid
interest, not a fresh percentage of principal.

**Loan write-off** is gated on `LOST` classification (DPD ≥ 360). Writing off a PERFORMING loan
throws `BadRequestException`.

**BVN uniqueness** is scoped per tenant (`@@unique([tenantId, bvn])`). The same customer BVN can
exist across two different banks (tenants) in the system.

**NIBSS suspense pattern**: every outward NIP transfer follows
`DEBIT customer → CREDIT NIBSS_SUSPENSE → (on confirm) DEBIT NIBSS_SUSPENSE → CREDIT NIBSS_SETTLEMENT`.
If NIBSS fails, the suspense entry is reversed back to the customer. Never short-circuit this.

**Idempotency key scope**: idempotency keys are global (not per-tenant). Use a format that
includes tenant context in the client-generated key, e.g. `{tenantCode}-{uuid}`.

**System account cache**: `GlService.getSystemAccount()` caches per `{tenantId}:{code}`.
Call `glService.clearSystemAccountCache()` after creating or modifying system accounts.

**Logo in PDFs**: always use `BrandingService.getLogoAsDataUri()` — never a presigned URL.
Puppeteer cannot make authenticated HTTP requests to MinIO at render time.
