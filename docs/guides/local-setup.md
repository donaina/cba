# Local Development Setup

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | 20.x | `node -v` |
| npm | 9.x | `npm -v` |
| Docker Desktop | 4.x | `docker -v` |
| Git | 2.x | `git -v` |

---

## Step 1 — Clone and install

```bash
git clone https://github.com/your-org/core-banking-app.git
cd core-banking-app
npm install
```

---

## Step 2 — Configure environment variables

```bash
cp .env.example .env
```

Minimum required values to set in `.env`:

```bash
JWT_SECRET=<random 32+ char string>
JWT_REFRESH_SECRET=<different random 32+ char string>
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

All third-party integrations (NIBSS, Termii, SendGrid, CRC) default to sandbox mode —
they log payloads locally instead of making real API calls.

---

## Step 3 — Start infrastructure services

```bash
docker compose up -d postgres rabbitmq minio minio-init
docker compose ps   # wait for "healthy" on all services (~15 seconds)
```

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | localhost:5432 | cba / cba_secret |
| RabbitMQ AMQP | localhost:5672 | cba / cba_secret |
| RabbitMQ UI | http://localhost:15672 | cba / cba_secret |
| MinIO S3 | localhost:9000 | minioadmin / minioadmin |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |

---

## Step 4 — Run database migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

---

## Step 5 — Seed the demo tenant

```bash
npm run onboard-tenant
```

Creates: org → branch → GL COA → transaction types → SUPER_ADMIN role → admin user
Prints: `admin@demo.bank / Admin@1234` (must change on first login)

---

## Step 6 — Start the application

```bash
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/v1/health

---

## Step 7 — Authenticate via Swagger

1. Open http://localhost:3000/api/docs
2. Call `POST /api/v1/auth/login` → `{ "email": "admin@demo.bank", "password": "Admin@1234" }`
3. Copy `accessToken` from response
4. Click **Authorize** (top right) → paste token

---

## Running Tests

```bash
npm run test:unit    # no DB required — runs in seconds
npm run test:e2e     # requires Docker services running
npm run test:all     # both
```

E2E tests run against the `cba_test` database (auto-created by `scripts/db/init.sql`).
Each suite seeds its own tenant data and cleans up after itself.

---

## VS Code Setup

`.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "humao.rest-client"
  ]
}
```

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": true }
}
```

`.vscode/launch.json` (attach debugger):
```json
{
  "version": "0.2.0",
  "configurations": [{
    "type": "node",
    "request": "attach",
    "name": "Attach to NestJS",
    "port": 9229,
    "restart": true,
    "sourceMaps": true,
    "outFiles": ["${workspaceFolder}/dist/**/*.js"]
  }]
}
```

Then run `npm run start:debug` and press **F5**.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `P1001 — Can't reach database` | `docker compose up -d postgres` |
| `ECONNREFUSED 127.0.0.1:5672` | `docker compose up -d rabbitmq` |
| `JWT_SECRET must be at least 32 characters` | Set proper value in `.env` |
| `Migration failed: column already exists` | `docker compose down -v && docker compose up -d postgres`, then re-migrate |
| `puppeteer: Could not find expected browser` | Set `PUPPETEER_EXECUTABLE_PATH` to your Chromium binary |
