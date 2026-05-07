# Transactions Module

**Path**: `modules/transactions/`

---

## Transaction categories

| Category | Description |
|----------|-------------|
| `OTC_DEPOSIT` | Cash deposit over the counter |
| `OTC_WITHDRAWAL` | Cash withdrawal over the counter |
| `INTRA_TRANSFER` | Transfer between accounts in the same bank |
| `INTER_BANK_TRANSFER` | NIP transfer to another bank via NIBSS |
| `LOAN_REPAYMENT` | Payment against a loan |
| `FEE_CHARGE` | Service or transaction fee |
| `INTEREST_PAYMENT` | Interest credited to an account |
| `REVERSAL` | Reversal of a prior completed transaction |

---

## Transaction status flow

```
PENDING_APPROVAL → QUEUED → PROCESSING → COMPLETED
                                        ↘ FAILED → REVERSED
```

---

## Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/transactions/deposit` | `txn:deposit` | OTC cash deposit |
| POST | `/transactions/withdraw` | `txn:withdraw` | OTC cash withdrawal |
| POST | `/transactions/transfer` | `txn:transfer` | Intra-bank transfer |
| POST | `/transactions/nip-transfer` | `txn:transfer` | NIP inter-bank transfer |
| POST | `/transactions/:id/approve` | `txn:approve` | Approve pending transaction |
| POST | `/transactions/:id/reject` | `txn:approve` | Reject pending transaction |
| POST | `/transactions/:id/reverse` | `txn:reverse` | Reverse completed transaction |
| GET | `/transactions/:id` | `txn:read` | Get transaction details |

---

## Idempotency

All financial endpoints require `Idempotency-Key` header.
Same key within 24 hours returns cached response — no re-execution.

Generate keys on the client: `{tenantCode}-{uuid}`
e.g. `SUNMFB-550e8400-e29b-41d4-a716-446655440000`

---

## Maker-checker queue

Transactions above configured threshold, or on specific channels, are held as
`PENDING_APPROVAL`. Rules are configured in `MakerCheckerConfig` per `[module, action]`.
Checker cannot be the same user as the maker.

---

## Fee calculation

```
baseFee  = flatFee + (amount × percentageFee)
baseFee  = clamp(baseFee, minFee, maxFee)
vat      = vatApplicable  ? baseFee × 0.075 : 0
wht      = whtApplicable  ? baseFee × 0.10  : 0
totalFee = baseFee + vat

if availableBalance < amount + totalFee → reject (before any posting)
```

---

## NIBSS suspense pattern (NIP transfers)

```
1. DEBIT  customer account    (availableBalance check first)
   CREDIT NIBSS_SUSPENSE

2a. On NIBSS success:
    DEBIT  NIBSS_SUSPENSE
    CREDIT NIBSS_SETTLEMENT

2b. On NIBSS failure:
    DEBIT  NIBSS_SUSPENSE      (reversal)
    CREDIT customer account
```

Never short-circuit this pattern — it ensures no double-spend on NIBSS failure.
