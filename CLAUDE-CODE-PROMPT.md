# How to Build This Project with Claude Code

This folder contains the complete specification for a multi-tenant Core Banking Application.
Use it as the context you feed to Claude Code in VS Code.

---

## Step 1 — Bootstrap the NestJS project

Tell Claude Code:

> "Scaffold a new NestJS project called `core-banking-app` using the NestJS CLI.
> Configure TypeScript path aliases so `@libs/*` maps to `libs/*/src` and
> `@modules/*` maps to `src/modules/*`. Install these dependencies:
> `@prisma/client prisma decimal.js @golevelup/nestjs-rabbitmq @nestjs/terminus
> @nestjs/passport passport passport-jwt @nestjs/jwt bcrypt minio @nestjs/schedule
> @nestjs/throttler @nestjs/axios helmet joi class-validator class-transformer
> puppeteer-core sharp string-similarity uuid`.
> Read CLAUDE.md before writing any code."

---

## Step 2 — Create the Prisma schemas

Tell Claude Code:

> "Create the Prisma root schema at `prisma/schema.prisma` using the content in
> `prisma/schema.prisma` from the spec folder. Then create all 17 domain schema
> files in `prisma/schemas/`. Start with `organisation.prisma`, `user.prisma`,
> `customer.prisma`, `gl.prisma`, `product.prisma`, and `account.prisma`.
> Every model must have a `tenantId String` field and an `@@index([tenantId, ...])`.
> All monetary fields use `Decimal @db.Decimal(20, 4)`.
> Read `docs/architecture/double-entry.md` and `docs/guides/cbn-compliance.md` first."

---

## Step 3 — Build module by module

Work through modules in this order (each depends on the previous):

1. **Database lib** — `libs/database/` (PrismaService, @Global module)
2. **Common lib** — `libs/common/` (TenantContext, TenantMiddleware, NubanUtil, AmortizationUtil, FeeCalculator, AuditLogInterceptor, IdempotencyMiddleware)
3. **GL module** — PostingEngine, GlService, COA controller
4. **Auth module** — JWT strategy, guards, session management, RBAC
5. **Customers module** — customer CRUD, KYC tier management
6. **KYC module** — BvnService (NIBSS), CreditBureauService (CRC)
7. **Documents module** — MinIO upload, KYC document management
8. **Admin module** — products, transaction types, tax rates, branding/logo
9. **Savings accounts** — account opening, NUBAN generation
10. **Current accounts** — overdraft, cheque management
11. **Fixed deposit** — openFd, liquidate, FdMaturityJob @ 23:00 WAT
12. **Loans** — apply, approve, disburse, repay, LoanEodJob @ 22:00 WAT
13. **Transactions** — OTC deposit/withdrawal, intra-transfer, maker-checker queue
14. **NIBSS** — name enquiry, outward transfer, inward credit, suspense pattern
15. **Notifications** — RabbitMQ consumer, Termii SMS, SendGrid email
16. **Reports** — account statement, trial balance, loan portfolio, PDF (Puppeteer)
17. **AML** — screening publisher, webhook controller, freeze/unfreeze, STR
18. **BaaS** — API keys, webhooks, HMAC signing
19. **Audit** — AuditLog controller
20. **Health** — /health, /health/ready, /health/live
21. **AppModule** — wire everything together
22. **main.ts** — Swagger, Helmet, CORS, global pipes, shutdown hooks
23. **Seed scripts** — GL COA, transaction types, tenant onboarding
24. **Docker** — docker-compose.yml, Dockerfile
25. **Tests** — unit tests for AmortizationUtil/FeeCalculator/NubanUtil/PostingEngine, E2E suites

---

## Prompt template for each module

> "Build the [MODULE_NAME] module. Read `docs/modules/[module].md` for the full
> spec and endpoint list. Read `CLAUDE.md` for the non-negotiable rules.
> Every service must inject TenantContext and filter all queries by tenantId.
> All monetary arithmetic must use Decimal.js. Write the service, controller,
> module, and DTOs. Add the module to AppModule imports."

---

## Key rules to repeat in every prompt

- Read `CLAUDE.md` before writing any code
- Every Prisma query includes `tenantId: this.ctx.tenantId`
- All money uses `Decimal.js` — no native floats
- All GL postings go through `PostingEngine.post()` — never write `TransactionEntry` directly
- Repayment waterfall: Penalty → Interest → Principal (never change this)
- Logo in PDFs: always `BrandingService.getLogoAsDataUri()` — never a presigned URL

---

## Files in this spec folder

```
CLAUDE.md                          ← Claude Code reads this automatically
README.md                          ← Project overview
CLAUDE-CODE-PROMPT.md              ← This file
prisma/
  schema.prisma                    ← Root Prisma schema
docs/
  architecture/
    overview.md                    ← System design, request lifecycle
    multi-tenancy.md               ← TenantContext, row-level isolation
    double-entry.md                ← GL rules, all journal entry patterns
  guides/
    local-setup.md                 ← Docker, migrations, seeding, VS Code config
    onboarding-tenant.md           ← Create a new bank tenant
    cbn-compliance.md              ← Every CBN rule encoded in the system
  modules/
    auth.md                        ← Auth endpoints, tokens, permissions
    gl.md                          ← GL accounts, posting engine
    accounts.md                    ← Savings, current, fixed deposit
    loans.md                       ← Loan lifecycle, amortisation, EOD job
    transactions.md                ← Deposits, withdrawals, NIP, maker-checker
    reports.md                     ← Statements, trial balance, PDF with logo
    aml.md                         ← Screening, alerts, freeze, STR
    notifications.md               ← RabbitMQ, SMS, email, templates
    admin.md                       ← Products, tax, branding/logo
  adr/
    001-monolith-vs-microservices.md
    002-decimal-js-for-money.md
    003-session-table-not-redis.md
    004-puppeteer-for-pdf.md
    005-rabbitmq-for-notifications.md
    006-prisma-split-schemas.md
```
