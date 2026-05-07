# ADR-006: Prisma Split Schema Files per Domain

**Date**: 2024-01 | **Status**: Accepted

## Context

Prisma defaults to a single `schema.prisma` file. With 20+ domain models this would
exceed 2,000 lines and be difficult to navigate and review.

## Decision

Use Prisma's `prismaSchemaFolder` preview feature — one `.prisma` file per domain
under `prisma/schemas/`.

## File structure

```
prisma/
├── schema.prisma          # Root: generator + datasource only
└── schemas/
    ├── organisation.prisma  # Organisation, Branch
    ├── user.prisma          # User, Role, Permission, Session
    ├── customer.prisma      # Customer, CustomerDocument
    ├── gl.prisma            # GLAccount, TransactionRecord, TransactionEntry
    ├── product.prisma       # Product, RateBand, TransactionTypeConfig
    ├── account.prisma       # Account
    ├── savings.prisma       # SavingsInterestAccrual
    ├── current.prisma       # OverdraftFacility, ChequeBook
    ├── fd.prisma            # FixedDepositDetails, FdInterestPayment, FdLiquidation
    ├── loan.prisma          # LoanApplication, LoanAccount, RepaymentSchedule…
    ├── nibss.prisma         # NibssSession, RegulatoryReport
    ├── notification.prisma  # NotificationLog, NotificationTemplate
    ├── baas.prisma          # ApiKey, Webhook, WebhookDelivery
    ├── admin.prisma         # TaxConfiguration, WorkingCalendar, MakerCheckerConfig
    ├── audit.prisma         # AuditLog
    ├── aml.prisma           # AmlScreening, AmlAlert, SuspiciousTransactionReport
    └── kyc.prisma           # BvnVerification, CreditBureauReport
```

## Enabling the feature

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
}
```

All `.prisma` files in the `prisma/` directory tree are automatically included.
No manual imports needed. Cross-domain relations use standard `@relation` syntax.

## Consequences

- `npx prisma generate` and `npx prisma migrate` work without changes
- Each domain schema file is ~100–200 lines — easy to review in isolation
- `prismaSchemaFolder` is a preview feature — verify stability before upgrading Prisma versions
