# Accounts Module

**Path**: `modules/accounts/` → `savings/`, `current/`, `fixed-deposit/`

---

## Account types

### Savings
- NUBAN 10-digit account number (CBN check digit via `NubanUtil`)
- Tiered interest rates via `RateBand`
- KYC tier-based balance limits enforced on deposit
- Monthly account maintenance fee

### Current
- Same NUBAN structure
- Overdraft facility (if configured on product)
- Cheque book management
- No credit interest; higher transaction limits

### Fixed Deposit
- Linked to parent savings/current account (source of funds)
- Negotiated interest rate (set at creation — can differ from product rate band)
- Three interest payment types: `UPFRONT`, `PERIODIC`, `AT_MATURITY`
- Premature liquidation penalty: 50% of earned/paid interest
- Auto-maturity actions: `TRANSFER_TO_ACCOUNT`, `ROLLOVER`, `PARTIAL_ROLLOVER`

---

## NUBAN generation

```typescript
const accountNumber = NubanUtil.generate(bankSortCode, serialNumber);
// bankSortCode: 3-digit CBN sort code (stored in Organisation.sortCode)
// serialNumber: auto-incremented, zero-padded to 9 digits
```

---

## Account statuses

| Status | Transactions allowed |
|--------|---------------------|
| `ACTIVE` | Yes (subject to balance/KYC checks) |
| `INACTIVE` | No |
| `FROZEN` | No — AML hold (set by AmlService.freezeAccounts) |
| `CLOSED` | No |
| `DORMANT` | Read-only; reactivation required |

---

## Fixed Deposit — interest type behaviour

| `interestPaymentType` | When interest is paid |
|----------------------|----------------------|
| `UPFRONT` | On FD creation — deducted from principal before posting |
| `PERIODIC` | On schedule (monthly/quarterly) via `FdMaturityJob` |
| `AT_MATURITY` | On maturity date only |

**Premature liquidation of UPFRONT FD**: the un-earned days' interest is clawed back —
not a fresh percentage penalty on the principal.

**Same-day liquidation**: blocked (`daysHeld < 1` → `BadRequestException`).

---

## FD Certificate PDF

`GET /accounts/fixed-deposit/:id/certificate` — generates an A4 PDF certificate.
The tenant logo (from `BrandingService.getLogoAsDataUri()`) is embedded inline
in the top-left header. See [reports.md](reports.md) for PDF generation details.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/accounts` | Open new savings or current account |
| GET | `/accounts/:id` | Account details |
| GET | `/accounts/:id/balance` | Current + available balance |
| PATCH | `/accounts/:id/status` | Change status |
| POST | `/accounts/fixed-deposit` | Open fixed deposit |
| POST | `/accounts/fixed-deposit/:id/liquidate` | Premature liquidation |
| GET | `/accounts/fixed-deposit/:id/certificate` | FD certificate PDF |
