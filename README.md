# Core Banking Application (CBA)

A production-grade, multi-tenant core banking system built for Nigerian financial institutions —
microfinance banks (MFBs), money lenders, BaaS providers, and commercial banks.

Built on **NestJS · PostgreSQL · Prisma · RabbitMQ · MinIO**

---

## Feature Overview

| Domain | Capabilities |
|--------|-------------|
| General Ledger | Double-entry bookkeeping, IFRS-aligned COA (4-level hierarchy), trial balance, serialisable posting |
| Customers & KYC | Individual & corporate onboarding, CBN KYC tiers 1/2/3, BVN verification, document upload |
| Savings Accounts | NUBAN account numbers, interest accrual, target savings, account maintenance fees |
| Current Accounts | Overdraft facilities, cheque books, VAT/WHT on charges |
| Fixed Deposits | Flexible/negotiated rates, upfront/periodic/at-maturity interest, premature liquidation penalty |
| Loans | Flat-rate & reducing-balance amortisation, bullet repayment, CBN DPD classification, IFRS 9 provisioning, write-off |
| Transactions | OTC deposit/withdrawal, intra-bank transfer, NIP/NIBSS inter-bank, maker-checker approval queue |
| Notifications | RabbitMQ-decoupled SMS (Termii) + email (SendGrid) + in-app |
| Reports | Account statements (PDF with bank logo), trial balance, loan portfolio, regulatory (CTR/STR) |
| BaaS | API key management, webhook delivery with HMAC signing and retry |
| AML | Onboarding & large-transaction screening, account freeze/unfreeze, STR filing |
| Branding | Logo upload/management; auto-embedded in all generated PDFs |
| Admin | Transaction types, tax rates (VAT/WHT), working calendar, maker-checker rules, products |
| Auth | JWT + DB session table, RBAC with granular permissions, OTP password reset |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20, TypeScript 5 |
| Framework | NestJS 10 (modular monolith) |
| Database | PostgreSQL 16 + Prisma ORM |
| Message broker | RabbitMQ 3.13 |
| Object storage | MinIO (S3-compatible) |
| Money arithmetic | Decimal.js (no native floats ever) |
| PDF generation | Puppeteer (HTML → A4 PDF) |
| Auth | Passport JWT + bcrypt |
| Tests | Jest (unit + E2E) |
| Containers | Docker + Docker Compose |

---

## Quick Start (Local Development)

### Prerequisites
- Docker Desktop 4+
- Node.js 20+
- npm 9+

### 1. Clone and install
```bash
git clone https://github.com/your-org/core-banking-app.git
cd core-banking-app
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and JWT_REFRESH_SECRET (min 32 chars each)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start infrastructure
```bash
docker compose up -d postgres rabbitmq minio minio-init
docker compose ps   # wait until all show "healthy"
```

### 4. Run database migrations
```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Seed the demo tenant
```bash
npm run onboard-tenant
# Prints: admin@demo.bank / Admin@1234 (must change on first login)
```

### 6. Start the app
```bash
npm run start:dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/api/v1 | REST API |
| http://localhost:3000/api/docs | Swagger UI |
| http://localhost:3000/api/v1/health | Health check |
| http://localhost:15672 | RabbitMQ UI (cba/cba_secret) |
| http://localhost:9001 | MinIO Console (minioadmin/minioadmin) |

---

## Project Structure

```
.
├── src/
│   ├── app.module.ts              # Root module
│   └── main.ts                    # Bootstrap (Swagger, Helmet, validation pipes)
├── modules/
│   ├── auth/                      # JWT, sessions, RBAC
│   ├── customers/                 # Customer onboarding, KYC
│   ├── kyc/                       # BVN (NIBSS), credit bureau (CRC)
│   ├── accounts/
│   │   ├── savings/
│   │   ├── current/
│   │   └── fixed-deposit/         # FdMaturityJob @ 23:00 WAT
│   ├── loans/                     # LoanEodJob @ 22:00 WAT
│   ├── transactions/              # Deposits, withdrawals, NIP, maker-checker
│   ├── gl/                        # PostingEngine, COA management
│   ├── nibss/                     # NIP suspense pattern
│   ├── notifications/             # RabbitMQ consumer, SMS, email
│   ├── reports/                   # Statements, trial balance, PDF
│   ├── documents/                 # MinIO KYC documents
│   ├── aml/                       # Screening, alerts, STR
│   ├── baas/                      # API keys, webhooks
│   ├── admin/                     # Products, tax, config, branding/logo
│   ├── audit/                     # Audit log viewer
│   └── health/                    # Health + readiness probes
├── libs/
│   ├── common/src/
│   │   ├── tenant/                # TenantContext, TenantMiddleware
│   │   ├── utils/                 # AmortizationUtil, NubanUtil
│   │   └── interceptors/         # AuditLogInterceptor, IdempotencyMiddleware
│   └── database/                  # PrismaService (@Global)
├── prisma/
│   ├── schema.prisma              # Root (prismaSchemaFolder feature)
│   └── schemas/                   # 18 split domain schema files
├── scripts/
│   ├── seeds/                     # gl.seed, tenant.seed, transaction-types.seed
│   └── onboard-tenant.ts
├── test/
│   ├── unit/                      # Fast pure unit tests
│   └── e2e/                       # Full lifecycle E2E tests
└── docs/
    ├── architecture/              # System design
    ├── modules/                   # Per-module reference
    ├── guides/                    # Setup and operational guides
    └── adr/                       # Architecture Decision Records
```

---

## Running Tests

```bash
npm run test:unit    # fast, no DB required
npm run test:e2e     # requires Docker services running
npm run test:all     # both
```

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `start:dev` | Hot-reload dev server |
| `start:debug` | Dev server + Node debugger (port 9229) |
| `build` | Compile TypeScript |
| `start:prod` | Run compiled production build |
| `test:unit` | Jest unit tests |
| `test:e2e` | Jest E2E tests |
| `seed` | GL + transaction type seeds for `SEED_TENANT_ID` |
| `onboard-tenant` | Full tenant bootstrap |
| `lint` / `format` | ESLint / Prettier |

---

## Documentation

- [Local Setup Guide](docs/guides/local-setup.md)
- [Onboarding a New Tenant](docs/guides/onboarding-tenant.md)
- [CBN Compliance Reference](docs/guides/cbn-compliance.md)
- [System Architecture](docs/architecture/overview.md)
- [Multi-Tenancy Design](docs/architecture/multi-tenancy.md)
- [Double-Entry Bookkeeping](docs/architecture/double-entry.md)
- [Module References](docs/modules/)
- [Architecture Decision Records](docs/adr/)

---

## Compliance

Designed for CBN-regulated institutions. See [docs/guides/cbn-compliance.md](docs/guides/cbn-compliance.md)
for the full list of regulatory rules encoded in the codebase.
