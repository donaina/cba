# ADR-001: NestJS Modular Monolith over Microservices

**Date**: 2024-01 | **Status**: Accepted

## Context

Core banking operations require strong transactional consistency. A deposit and its GL postings
must succeed or fail atomically. A loan disbursement updates the loan account, the customer's
savings balance, and the GL in one transaction. These operations span multiple domain boundaries.

Options considered:
1. **Microservices** — separate deployable services per domain
2. **Modular monolith** — single deployable process, clean module boundaries, shared database

## Decision

**NestJS modular monolith.**

## Reasons

**Distributed transactions are hard and fragile.** Coordinating multi-step financial operations
across services requires 2PC (slow, known failure modes) or Saga (compensating transactions,
difficult to audit). A single Prisma `$transaction()` with Serializable isolation is simpler,
faster, and gives exactly the guarantees needed.

**Module boundaries are already clean.** NestJS modules enforce separation at compile time.
Moving a module to a separate service later is an infrastructure change — not a code change.

**Solo initial development.** 10 docker-compose services + distributed tracing + inter-service
auth adds overhead for a team of one.

**Nigerian infrastructure.** Network latency between services is non-trivial. A monolith
eliminates internal latency entirely.

## Consequences

- Single Docker image to deploy and monitor
- Scale vertically or run multiple stateless instances behind a load balancer
- Future: extract high-traffic modules (e.g. NIBSS) to separate services without changing interfaces
- E2E tests boot the entire app in-process — no mocking of inter-service calls
