# Loans Module

**Path**: `modules/loans/`

---

## Loan lifecycle

```
PENDING_REVIEW → APPROVED → ACTIVE → CLOSED
               ↘ DECLINED          ↘ WRITTEN_OFF (LOST classification only)
```

---

## Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/loans/apply` | `loan:apply` | Submit application |
| PATCH | `/loans/:id/approve` | `loan:approve` | Approve with terms |
| PATCH | `/loans/:id/decline` | `loan:approve` | Decline with reason |
| POST | `/loans/:id/disburse` | `loan:disburse` | Disburse to account |
| POST | `/loans/:id/repay` | `txn:deposit` | Make repayment |
| POST | `/loans/:id/write-off` | `loan:write-off` | Write off LOST loan |
| GET | `/loans/:id/schedule` | `loan:read` | View repayment schedule |

---

## Amortisation types

| Type | Behaviour |
|------|-----------|
| `FLAT_RATE` | Interest = P × r × tenor/365, split equally per instalment |
| `REDUCING_BALANCE` | EMI = P × r × (1+r)^n / ((1+r)^n - 1); interest reduces each period |
| `BULLET` | Interest-only instalments; full principal on final instalment |

All types implemented in `AmortizationUtil`. Last instalment absorbs rounding residue
so closing balance = exactly ₦0.00.

---

## Repayment waterfall (CBN-mandated — never change the order)

```
1. Penalty charges
2. Accrued interest
3. Principal
4. Excess → returned to source account
```

---

## Nightly EOD job (`LoanEodJob`)

Runs at **22:00 WAT** daily. For each active/overdue loan:
1. `accrueOverduePenalty()` — adds `outstandingPrincipal × (contractRate + 5%) / 365` to `accruedPenalty`
2. `classifyLoan()` — finds oldest unpaid instalment's DPD, updates classification + provision rate, posts provision GL entry

Both operations are idempotent per loan per day.

---

## DPD → Classification

| DPD | Classification | Provision rate |
|-----|---------------|----------------|
| 0–89 | PERFORMING | 1% |
| 90–179 | WATCH | 5% |
| 180–269 | SUBSTANDARD | 25% |
| 270–359 | DOUBTFUL | 50% |
| 360+ | LOST | 100% |

---

## Credit bureau integration

`CreditBureauService.pullReport()` is called inside `approve()` before finalising.

Default policy:
- `POOR` classification → auto-decline
- NPL count > 0 → auto-decline
- `GOOD` or `FAIR` → proceed

Override in `LoanService.approve()` per your institution's credit policy.

---

## Constants

```typescript
PENAL_RATE_PA        = 0.05   // 5% above contract rate
PROVISION_RATES      = { PERFORMING: 0.01, WATCH: 0.05, SUBSTANDARD: 0.25, DOUBTFUL: 0.50, LOST: 1.00 }
CBN_CLASSIFICATION   = [[360,'LOST'],[270,'DOUBTFUL'],[180,'SUBSTANDARD'],[90,'WATCH'],[0,'PERFORMING']]
```
