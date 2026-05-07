# ADR-002: Decimal.js for All Monetary Arithmetic

**Date**: 2024-01 | **Status**: Accepted

## Context

JavaScript's `Number` type uses IEEE 754 double-precision floating-point:
```javascript
0.1 + 0.2 === 0.30000000000000004  // true in JS
```
A ₦0.01 error propagating across thousands of transactions causes GL imbalances,
incorrect loan balances, and regulatory issues.

## Decision

All monetary values use **Decimal.js**. Values stored in PostgreSQL as `Decimal(20,4)`
columns via Prisma — stored as exact decimal strings, not floating-point.

## Rules

1. Never use `+`, `-`, `*`, `/` on monetary values — always use Decimal methods
2. Never use `Number()` or `parseFloat()` to convert monetary strings from DB
3. Always `new Decimal(value)` when reading from Prisma
4. Always `.toFixed(4)` when writing back to Prisma

## Why Decimal.js over alternatives

| Library | Reason not chosen |
|---------|------------------|
| `big.js` | No trig functions (needed for amortisation) |
| `bignumber.js` | Same author, Decimal.js more widely used in fintech |
| Native `BigInt` | Integer only — cannot represent ₦10,000.75 |
| PostgreSQL NUMERIC + string | Every operation requires a DB round-trip |

## Consequences

- All calculation utilities accept and return `Decimal`
- Jest tests use `new Decimal(x).equals(y)` not `x === y` for monetary assertions
- Prisma schema uses `Decimal` type for all amount fields
