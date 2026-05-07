# ADR-003: DB Session Table over Redis for JWT Sessions

**Date**: 2024-01 | **Status**: Accepted

## Context

JWT refresh tokens need to be revocable. Without a server-side store, a stolen refresh
token is valid until it naturally expires (7 days).

Options:
1. **Redis** — fast in-memory store; token invalidation is O(1)
2. **PostgreSQL Session table** — slightly slower, uses the same DB already in use

## Decision

**PostgreSQL `Session` table.**

## Reasons

**No additional infrastructure.** Redis = another service to deploy, monitor, and back up.
We already have PostgreSQL. A single indexed lookup per request is well within
PostgreSQL's performance envelope (< 10,000 concurrent sessions per tenant for an MFB).

**Auditability.** Sessions in the DB can be queried, reported on, and joined with other tables.
A compliance officer can see all active sessions for a user, when they were created, from which IP.

**Consistency.** When a user is deactivated, all their sessions can be invalidated in the same
DB transaction. With Redis, you'd need a separate call that could fail independently.

**Correctness under failure.** If Redis goes down, all sessions are lost. If PostgreSQL goes down,
the app is down anyway (no request can be served). Redis adds a second point of failure for
a benefit not needed at this scale.

## Consequences

- Every authenticated request does one extra DB query (Session lookup by sessionId)
- Acceptable because all API routes already do at least one DB query
- If load exceeds this: add a Redis cache layer in front of the session table
  without changing the session schema or auth contract
