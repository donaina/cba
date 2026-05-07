# CBN Compliance Reference

Every Central Bank of Nigeria regulatory rule encoded in this system.

---

## KYC Tiers

| Tier | Documents required | Max balance | Max single txn |
|------|--------------------|------------|----------------|
| Tier 1 | BVN + passport photo | ₦300,000 | ₦50,000 |
| Tier 2 | BVN + NIN + passport photo | ₦500,000 | ₦200,000/day cumulative |
| Tier 3 | BVN + NIN + utility bill + passport photo | Unlimited | Per product config |

**Enforcement**: `CustomerService.checkAndUpgradeKycTier()` — tier upgraded automatically on document verification.
**Reference**: CBN KYC Regulations 2023.

---

## NUBAN Account Numbers

- **Standard**: CBN NUBAN specification (FPR/DIR/CIR/GEN/01/020)
- **Format**: 10 digits = 9-digit serial + 1 check digit
- **Algorithm**: Weights `[3,7,3,3,7,3,3,7,3]` on (bankSortCode + serial), sum mod 10, check = (10 - sum) mod 10
- **Enforcement**: `NubanUtil.generate()` at account creation; `NubanUtil.validate()` on every inter-bank transfer input
- **Violation**: `BadRequestException` before NIBSS is reached

---

## NIP Transfer Fees (CBN schedule)

| Amount | Fee (VAT-inclusive) |
|--------|-------------------|
| ₦1 – ₦5,000 | ₦10.75 |
| ₦5,001 – ₦50,000 | ₦26.88 |
| ₦50,001 and above | ₦53.75 |

**Enforcement**: `FeeCalculator` reads from `TransactionTypeConfig` seeded with these values.
**VAT**: Included above (7.5% of base). GL: `NIP_FEE_INCOME` + `VAT_PAYABLE`.

---

## Loan Classification (DPD-based)

| Days Past Due | Classification | IFRS 9 Provision Rate |
|--------------|---------------|----------------------|
| 0 – 89 | PERFORMING | 1% |
| 90 – 179 | WATCH | 5% |
| 180 – 269 | SUBSTANDARD | 25% |
| 270 – 359 | DOUBTFUL | 50% |
| 360+ | LOST | 100% |

**Enforcement**: `LoanService.classifyLoan()` via `LoanEodJob` at 22:00 WAT daily.
**DPD**: Days since oldest unpaid instalment's due date.
**Write-off**: Only allowed when classification = `LOST`.

---

## Interest Calculation

```
Simple/Flat Interest (CBN standard for MFBs):
  Interest = Principal × Rate × Days / 365

Reducing Balance EMI:
  EMI = P × r × (1+r)^n / ((1+r)^n - 1)
  where r = annual rate / periods_per_year
```

**Always use 365-day year** — CBN mandates this. Never use 360-day basis.

---

## Repayment Waterfall (CBN-mandated — never change the order)

1. Penalty charges (overdue penalty interest)
2. Accrued contractual interest
3. Principal

Excess after full repayment is returned to the source account.
**Enforcement**: `LoanService.repay()` — hardcoded, never configurable.

---

## Penal Rate

- **Rate**: 5% per annum above contract rate
- **Applied to**: Overdue outstanding principal, per day
- **Enforcement**: `LoanService.accrueOverduePenalty()` via `LoanEodJob`
- **GL**: `DEBIT penalty receivable / CREDIT PENALTY_INCOME`

---

## Withholding Tax (WHT)

- **Rate**: 10% on Fixed Deposit interest income
- **Enforcement**: `FixedDepositService` (constant `DEFAULT_WHT_RATE = 0.10`)
- **GL**: `CREDIT WHT_PAYABLE` (10% portion of interest expense)
- **Configurable**: Rate stored in `TaxConfiguration` table, effective-dated per tenant

---

## Value Added Tax (VAT)

- **Rate**: 7.5% on transaction fees and service charges
- **Enforcement**: `FeeCalculator` checks `TransactionTypeConfig.vatApplicable`
- **GL**: Portion of fee → `VAT_PAYABLE`
- **Configurable**: Rate stored in `TaxConfiguration`, effective-dated

---

## Currency Transaction Reports (CTR)

- **Threshold**: ₦5,000,000 per single transaction
- **Enforcement**: `NibssService.fileCtr()` + `AmlPublisher.screenLargeTransaction()`
- **Storage**: `RegulatoryReport` table (`reportType = CTR`)

---

## Suspicious Transaction Reports (STR)

- **Trigger**: AML callback with `action = FILE_STR`, or manual filing by compliance officer
- **Flow**: `DRAFT → SUBMITTED → ACKNOWLEDGED`
- **Submission**: `POST /compliance/str/{id}/submit` → calls NFIC/EFCC API in production

---

## PEP Screening

AML onboarding screening is triggered after KYC document verification.
PEP matches create `AmlAlert` with `alertType = PEP_MATCH`.
Compliance officer must resolve before account can be fully activated.

---

## Data Retention

CBN requires transaction records retained for minimum **7 years**.
No automated archival is implemented — all data retained indefinitely.
Implement a compliant archival strategy before going live with real customers.
