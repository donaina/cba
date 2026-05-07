# Double-Entry Bookkeeping

## The fundamental rule

Every financial event creates at least two ledger entries — one debit and one credit, equal in amount.

```
SUM(debit entries) === SUM(credit entries)   // always enforced by PostingEngine
```

`PostingEngine` throws `'Journal does not balance'` before any DB write if entries don't balance.

---

## GL Account hierarchy

```
CATEGORY          (e.g. ASSETS)
  └─ HEADER       (e.g. CASH & CASH EQUIVALENTS)
       └─ SUB_HEADER  (e.g. VAULT CASH)
              └─ DETAIL   ← only DETAIL accounts accept postings
```

Postings can only be made to `DETAIL`-level accounts. Balances at HEADER/CATEGORY level
are derived by summing children.

---

## Normal balances

| Account type | Normal balance | Increases with | Decreases with |
|-------------|---------------|----------------|---------------|
| ASSET | DEBIT | Debit | Credit |
| LIABILITY | CREDIT | Credit | Debit |
| EQUITY | CREDIT | Credit | Debit |
| INCOME | CREDIT | Credit | Debit |
| EXPENSE | DEBIT | Debit | Credit |

---

## Common journal entries

### OTC Cash Deposit (₦10,000)
```
DEBIT  VAULT_CASH        10,000   (asset increases — cash received)
CREDIT SAVINGS_CONTROL   10,000   (liability increases — we owe customer)
```

### OTC Cash Withdrawal (₦5,000)
```
DEBIT  SAVINGS_CONTROL   5,000    (liability decreases)
CREDIT VAULT_CASH        5,000    (asset decreases — cash paid out)
```

### NIP Outward Transfer (₦50,000)
```
Step 1 — debit customer, hold in suspense:
DEBIT  SAVINGS_CONTROL   50,000
CREDIT NIBSS_SUSPENSE    50,000

Step 2 — on NIBSS confirmation:
DEBIT  NIBSS_SUSPENSE    50,000
CREDIT NIBSS_SETTLEMENT  50,000
```

### Loan Disbursement (₦200,000 principal, ₦5,000 upfront fee)
```
DEBIT  LOAN_PORTFOLIO    200,000
CREDIT SAVINGS_CONTROL   195,000  (net of fee)
CREDIT FEE_INCOME          5,000
```

### Loan Repayment (₦10,000: ₦500 penalty + ₦2,000 interest + ₦7,500 principal)
```
DEBIT  SAVINGS_CONTROL   10,000
CREDIT PENALTY_INCOME       500
CREDIT INTEREST_INCOME    2,000
CREDIT LOAN_PORTFOLIO     7,500
```

### Fixed Deposit Opening (₦500,000)
```
DEBIT  SAVINGS_CONTROL        500,000
CREDIT FIXED_DEPOSIT_CONTROL  500,000
```

### FD Interest Payment (₦3,000 gross, ₦300 WHT, ₦2,700 net)
```
DEBIT  FD_INTEREST_EXP    3,000
CREDIT WHT_PAYABLE          300   (10% WHT — remit to FIRS)
CREDIT SAVINGS_CONTROL    2,700   (net to customer)
```

### IFRS 9 Provision (₦10,000)
```
DEBIT  PROVISION_EXPENSE    10,000
CREDIT LOAN_LOSS_PROVISION  10,000
```

### Loan Write-Off (₦150,000 LOST loan)
```
DEBIT  BAD_DEBT_EXPENSE    150,000
CREDIT LOAN_PORTFOLIO      150,000
```

---

## PostingEngine internals

```typescript
async post(journal: JournalEntry): Promise<TransactionRecord> {
  // 1. Assert balance
  const debits  = entries.filter(e => e.entryType === 'DEBIT') .reduce(sum, Decimal(0));
  const credits = entries.filter(e => e.entryType === 'CREDIT').reduce(sum, Decimal(0));
  if (!debits.equals(credits)) throw new Error('Journal does not balance');

  // 2. Resolve GL account IDs from codes (via GlService cache)

  // 3. Write atomically in Serializable transaction
  return prisma.$transaction(async (tx) => {
    const record = await tx.transactionRecord.create(...);
    await tx.transactionEntry.createMany(...);
    return record;
  }, { isolationLevel: 'Serializable' });
}
```

---

## Verifying GL balance (SQL)

```sql
SELECT
  SUM(CASE WHEN "entryType" = 'DEBIT'  THEN amount ELSE 0 END) AS total_debits,
  SUM(CASE WHEN "entryType" = 'CREDIT' THEN amount ELSE 0 END) AS total_credits,
  SUM(CASE WHEN "entryType" = 'DEBIT'  THEN amount ELSE 0 END)
- SUM(CASE WHEN "entryType" = 'CREDIT' THEN amount ELSE 0 END) AS imbalance
FROM "TransactionEntry"
WHERE "tenantId" = '<your-tenant-id>';
-- imbalance must always be 0
```
