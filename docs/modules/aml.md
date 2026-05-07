# AML Module

**Path**: `modules/aml/`

---

## Screening triggers

| Event | When | Method |
|-------|------|--------|
| Customer onboarding | After first KYC document verified | `AmlPublisher.screenNewCustomer()` |
| Large transaction | Any single transaction ≥ ₦5,000,000 | `AmlPublisher.screenLargeTransaction()` |

Both publish to RabbitMQ exchange `cba.transactions`:
- Routing key `aml.screen.customer`
- Routing key `aml.screen.transaction`

An external AML vendor consumes these and calls back via the webhook endpoint.

---

## Webhook callback

```
POST /webhooks/aml/callback
```

Auth: HMAC-SHA256 in `X-AML-Signature` header.
Replay protection: requests older than 5 minutes rejected.

Payload actions:
- `FREEZE_ACCOUNT` → freezes listed `accountIds`, notifies customer in-app
- `FILE_STR` → auto-creates DRAFT STR
- Neither → creates alert records, emails compliance officers

---

## Staff endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/compliance/alerts` | `compliance:read` | List AML alerts |
| PATCH | `/compliance/alerts/:id/resolve` | `compliance:alert` | Resolve with note |
| PATCH | `/compliance/accounts/:id/freeze` | `compliance:alert` | Manually freeze account |
| PATCH | `/compliance/accounts/:id/unfreeze` | `compliance:alert` | Unfreeze with note |
| POST | `/compliance/str` | `compliance:alert` | File STR |
| POST | `/compliance/str/:id/submit` | `compliance:alert` | Submit STR to NFIC |

---

## Alert severity

| Severity | Action required |
|----------|----------------|
| `LOW` | Monitor |
| `MEDIUM` | Review within 5 business days |
| `HIGH` | Same-day review |
| `CRITICAL` | Immediate freeze recommended |

---

## STR filing process

```
1. POST /compliance/str         → DRAFT (officer writes narrative)
2. POST /compliance/str/:id/submit → SUBMITTED (calls NFIC/EFCC API)
3. Acknowledgement received     → ACKNOWLEDGED
```
