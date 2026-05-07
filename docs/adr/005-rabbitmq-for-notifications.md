# ADR-005: RabbitMQ for Async Notifications

**Date**: 2024-01 | **Status**: Accepted

## Context

Notifications (SMS, email, in-app) need to be sent after financial events.

Options:
1. **Synchronous in-process** — call Termii/SendGrid directly from the service method
2. **RabbitMQ message queue** — publish event; consumer processes independently

## Decision

**RabbitMQ — fully decoupled notifications.**

## Reasons

**Termii/SendGrid are external services that can fail.** If Termii is down during a deposit,
the customer's money still arrives. With synchronous notifications, the deposit would appear
to fail even though the GL entries were written.

**Retries are built into the queue.** If SMS delivery fails, the message stays in the queue
and is retried. Synchronous calls require custom retry logic in the service layer.

**Dead-letter exchange (DLX) for observability.** Failed messages after all retries go to
`cba.dlx`. Ops teams can inspect failed notifications, fix the issue, and re-queue without
touching the database.

**Performance.** A deposit completes in <100ms. With synchronous email, the response would
wait for SendGrid API latency (~200ms). Async keeps response times fast.

## Consequences

- Notifications are eventually consistent — a few seconds' delay between transaction and SMS
- Notification failures do not surface to the customer as errors
- `NotificationLog` table provides delivery visibility
- RabbitMQ must be running for the app to function (in `depends_on` in docker-compose)
- Exchange: `cba.transactions` (topic, durable); DLX: `cba.dlx` (topic, durable)
