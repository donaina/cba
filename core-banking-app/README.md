# core-banking-app

NestJS 11 application source. See the [root README](../README.md) for full project documentation, quick-start guide, and architecture overview.

## Local development

```bash
# From this directory (core-banking-app/)

cp .env.example .env          # set JWT_SECRET, JWT_REFRESH_SECRET (min 32 chars)
docker compose up -d          # start Postgres, RabbitMQ, MinIO
npx prisma db push            # apply schema (Prisma 7 — no migration files needed in dev)
npx prisma generate
npm run onboard-tenant        # seed demo tenant → prints admin credentials
npm run start:dev             # http://localhost:3000/api/v1
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000/api/v1 | REST API |
| http://localhost:3000/api/docs | Swagger UI (all endpoints documented) |
| http://localhost:3000/api/v1/health | Health check |
| http://localhost:15672 | RabbitMQ UI (cba / cba_secret) |
| http://localhost:9001 | MinIO Console (minioadmin / minioadmin) |
