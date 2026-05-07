# Notifications Module

**Path**: `modules/notifications/`

---

## Architecture — fully decoupled via RabbitMQ

```
BusinessService.doSomething()
    └─ amqp.publish('cba.transactions', 'notification.send', payload)
         └─ [RabbitMQ]
              └─ NotificationConsumer (@RabbitSubscribe)
                   └─ NotificationService.send()
                        ├─ Fetch customer contacts
                        ├─ Render template (from NotificationTemplate table)
                        ├─ sendSms()   → Termii API (sandbox: log only)
                        └─ sendEmail() → SendGrid API (sandbox: log only)
                        └─ Write to NotificationLog
```

A failure in Termii or SendGrid never blocks a deposit or loan disbursement.

---

## Channels

| Channel | Provider | Sandbox |
|---------|---------|---------|
| `SMS` | Termii | Logs payload, no real SMS |
| `EMAIL` | SendGrid | Logs payload, no real email |
| `IN_APP` | DB (NotificationLog) | Always writes to DB |

---

## Template keys

| Key | Trigger |
|-----|---------|
| `DEPOSIT_ALERT` | OTC deposit completed |
| `WITHDRAWAL_ALERT` | OTC withdrawal completed |
| `TRANSFER_ALERT` | Intra/inter-bank transfer completed |
| `LOAN_DISBURSEMENT` | Loan disbursed |
| `LOAN_REPAYMENT` | Loan repayment received |
| `FD_MATURITY` | Fixed deposit matured |
| `ACCOUNT_FROZEN` | Account frozen by AML |
| `ACCOUNT_UNFROZEN` | Account unfrozen |
| `AML_ALERT` | Compliance officer AML notification |
| `OTP_RESET` | Password reset OTP |

Templates stored in `NotificationTemplate` table per tenant.
Variables: `{{accountNumber}}`, `{{amount}}`, `{{narration}}`, etc.

---

## Dead-letter queue

Failed notifications (after all retries) → `cba.dlx` exchange.
Monitor in RabbitMQ UI. Messages include original payload and can be re-queued
after fixing the underlying issue (e.g. expired API key).
