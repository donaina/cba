# Core Banking Application — Setup Guide

> **Who this is for:** Anyone setting up this application for the first time, whether on a
> laptop for development or on a cloud platform for team testing.
>
> **How to use this guide:** Work through it top to bottom. Each section ends with a
> verification step so you know whether to proceed or fix something before moving on.

---

## Table of Contents

- [Part 1 — How the Application Works](#part-1--how-the-application-works)
- [Part 2 — Local Setup (your laptop)](#part-2--local-setup-your-laptop)
- [Part 3 — Online Setup on Railway (recommended cloud option)](#part-3--online-setup-on-railway)
- [Part 4 — Online Setup on Render (free-tier alternative)](#part-4--online-setup-on-render)
- [Part 5 — First-Time Configuration (all environments)](#part-5--first-time-configuration)
- [Part 6 — Testing the API](#part-6--testing-the-api)
- [Part 7 — Environment Variables Reference](#part-7--environment-variables-reference)
- [Part 8 — Troubleshooting](#part-8--troubleshooting)

---

## Part 1 — How the Application Works

Understanding the four services before starting will save you a lot of debugging time.

### The four services

```
Your HTTP Client (Postman / curl / browser)
           │
           │ HTTP :3000
           ▼
  ┌─────────────────────┐
  │   NestJS API App    │  ← The application you are deploying
  │   (25 modules)      │
  └──────┬──────┬───────┘
         │      │         │
    SQL  │   AMQP│    S3 API│
         ▼      ▼         ▼
  ┌──────────┐ ┌────────┐ ┌─────────┐
  │PostgreSQL│ │RabbitMQ│ │  MinIO  │
  │          │ │        │ │(or S3)  │
  │ All data │ │ Async  │ │  Files  │
  │ GL, accts│ │ notifs │ │ Docs PDF│
  └──────────┘ └────────┘ └─────────┘
```

| Service | What it does | If it's missing |
|---------|-------------|-----------------|
| **NestJS** | The API — all business logic, authentication, GL, loans | App won't start |
| **PostgreSQL** | Stores everything: tenants, customers, accounts, GL, transactions | App won't start |
| **RabbitMQ** | Delivers SMS/email notifications asynchronously via a queue | App starts but notification endpoints fail |
| **MinIO** | Stores binary files: KYC documents, statement PDFs, bank logos | App starts but file upload/download endpoints fail |

### Sandbox mode

All external integrations (NIBSS inter-bank, Termii SMS, SendGrid email, CRC credit bureau)
have a sandbox flag in the environment configuration. When the sandbox flag is `true`, the
service logs the outbound payload to the console instead of making real API calls. This means
you can test the complete banking flow end-to-end without any external accounts or contracts.

---

## Part 2 — Local Setup (your laptop)

**Use this for:** Development, running tests, building new features.  
**Cost:** Free.  
**Time:** 15–20 minutes (plus download time).

---

### Step 1 — Install the required tools

You need four tools. Check each one, install it if missing, then verify.

#### Node.js 20

Node.js is the runtime that executes the application. Version 20 (LTS) is required.

**Check if installed:**
```bash
node --version
# Must print v20.x.x — if it prints v18 or lower, upgrade
```

**Install:**

| OS | Command |
|----|---------|
| macOS | `brew install node@20` |
| Ubuntu/Debian | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| Windows | Download the LTS installer from https://nodejs.org and run it |

After installing, open a **new terminal** and run `node --version` again to confirm.

---

#### Docker Desktop

Docker runs PostgreSQL, RabbitMQ, and MinIO as lightweight containers so you do not need
to install those services directly on your machine.

**Check if installed:**
```bash
docker --version
# Must print Docker version 24.x or higher
```

**Install:** Download from https://www.docker.com/products/docker-desktop and run the installer.

After installing, **open the Docker Desktop app** and wait for the whale icon in your menu
bar to stop animating. This means Docker is ready. If you skip this step, every `docker`
command will fail with "Cannot connect to Docker daemon."

> **Windows note:** Docker on Windows requires WSL2 (Windows Subsystem for Linux v2).
> The Docker installer will prompt you to enable it. Follow those instructions before continuing.

---

#### Git

Git downloads the source code from GitHub.

**Check if installed:**
```bash
git --version
# Must print git version 2.x
```

**Install:**

| OS | Command |
|----|---------|
| macOS | `brew install git` |
| Ubuntu | `sudo apt install git` |
| Windows | Download from https://git-scm.com |

---

#### ts-node (for the tenant setup script)

ts-node runs TypeScript files directly without a separate compile step. You only need this
for the tenant onboarding script — the main application uses `npm run build` instead.

```bash
npm install -g ts-node typescript
ts-node --version
# Must print v10.x.x
```

---

### Step 2 — Get the source code

```bash
git clone https://github.com/donaina/cba.git
cd cba/core-banking-app
```

> **Why `core-banking-app/`?** The repository root contains the app, documentation, and
> deployment configs. The NestJS project itself lives in `core-banking-app/`. All commands
> in Part 2 are run from inside that directory unless stated otherwise.

---

### Step 3 — Install Node.js dependencies

```bash
npm install
```

This reads `package.json` and downloads all required packages (~800 packages, ~500 MB).
It also auto-generates the Prisma client — the TypeScript database types your IDE uses.

**Expected output (last few lines):**
```
added 847 packages in 45s
```

If you see errors about missing native packages (like `bcrypt` or `sharp`), run:
```bash
npm install --build-from-source
```

---

### Step 4 — Create and configure the environment file

The application reads all its configuration from a `.env` file. A template is provided:

```bash
cp .env.example .env
```

Open `.env` in your text editor. The only values you **must** change before the app will
start are the JWT secrets. Everything else can stay as-is for local development.

**Generate two secrets** (run this command twice — use each output for one secret):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Edit `.env` and set these two lines:**
```env
JWT_SECRET=<paste first output here>
JWT_REFRESH_SECRET=<paste second output here>
```

**Why two secrets?** The application issues two types of tokens:
- **Access token** (15-minute lifetime) — used on every API call, signed with `JWT_SECRET`
- **Refresh token** (7-day lifetime) — used to get a new access token without re-logging in,
  signed with `JWT_REFRESH_SECRET`

Using different secrets means a compromised access token cannot be used to forge a refresh
token and vice versa.

**Your complete local `.env` should look like this:**
```env
# ── Database ─────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cba

# ── Auth ─────────────────────────────────────────────────────
JWT_SECRET=a1b2c3d4e5f6...           # your first generated value
JWT_REFRESH_SECRET=f6e5d4c3b2a1...   # your second generated value
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# ── MinIO (local Docker) ──────────────────────────────────────
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=core-banking

# ── RabbitMQ (local Docker) ───────────────────────────────────
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# ── External integrations (all sandboxed locally) ─────────────
NIBSS_SANDBOX=true
TERMII_SANDBOX=true
SENDGRID_SANDBOX=true
CREDIT_BUREAU_SANDBOX=true

# ── App ───────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
```

---

### Step 5 — Start the infrastructure (Postgres, RabbitMQ, MinIO)

> **Before running this:** Make sure your terminal is inside the `core-banking-app/` directory.
> Every command from Step 3 onward runs from there.
> ```bash
> cd cba/core-banking-app   # run this if you haven't already
> ```

```bash
docker-compose up -d postgres rabbitmq minio minio-init
```

**What each container does:**

- `postgres` — starts PostgreSQL on port 5432. On first startup it runs `scripts/db/init.sql`
  which creates the `cba` database and the `cba_app` database role automatically.
- `rabbitmq` — starts RabbitMQ message broker on port 5672.
  The management web UI is available at `http://localhost:15672` (login: guest/guest).
- `minio` — starts MinIO file storage on port 9000.
  The web console is at `http://localhost:9001` (login: minioadmin/minioadmin).
- `minio-init` — a one-shot helper that creates the `core-banking` bucket inside MinIO,
  then exits. You will never see it in `docker-compose ps` after it runs.

**Verify all services are healthy:**
```bash
docker-compose ps
```

Wait about 30 seconds after starting, then run this. The expected output:
```
NAME           STATUS          PORTS
cba_postgres   Up (healthy)    0.0.0.0:5432->5432/tcp
cba_rabbitmq   Up (healthy)    0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp
cba_minio      Up (healthy)    0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
```

If any service shows `Up (starting)`, wait another 20 seconds and check again.

If a service shows `Up (unhealthy)` or `Exit`, view its logs:
```bash
docker-compose logs postgres    # replace with the failing service name
```

**Do not proceed until all three show `(healthy)`.**

---

### Step 6 — Create the database tables

The Docker container is running PostgreSQL, but the database is empty — no tables exist yet.
This command reads the Prisma schema files and creates all 40+ tables, indexes, and constraints:

```bash
npx prisma db push
```

**Expected output:**
```
Prisma schema loaded from prisma.
Environment variables loaded from .env.
Datasource "db": PostgreSQL database "cba" at "localhost:5432"

🚀  Your database is now in sync with your Prisma schema.
✔ Generated Prisma Client (v7.x.x)
```

If it says `Can't reach database server`, Postgres is not running or not yet healthy.
Go back to Step 5.

> **Note on migrations:** `db push` applies changes directly without creating migration
> files. For a production system you would use `npx prisma migrate dev --name init`
> instead, which creates SQL migration files you can review and commit to git. `db push`
> is fine for development and testing.

---

### Step 7 — Create the first bank tenant

The application is multi-tenant — each bank is a separate isolated tenant. At least one
tenant must exist before anyone can log in. This script creates the tenant, its full
chart of accounts, all permissions, and an admin user:

```bash
npx ts-node scripts/onboard-tenant.ts \
  --name "First Test Bank" \
  --shortName "FTB" \
  --tenantCode "FTB001" \
  --sortCode "000001" \
  --email "admin@ftb.ng" \
  --password "Admin@1234"
```

**What each parameter means:**

| Parameter | Purpose | Notes |
|-----------|---------|-------|
| `--name` | Full legal name of the bank | Used in reports and statements |
| `--shortName` | Abbreviated name | Used in UI headers |
| `--tenantCode` | Short login code | Users enter this at login alongside their email — make it memorable |
| `--sortCode` | 6-digit CBN sort code | Used to generate NUBAN account numbers. Use `000001` for testing |
| `--email` | Super-admin login email | You will use this to log in |
| `--password` | Super-admin password | Change this after first login |

**Expected output:**
```
Organisation created: 3f4a5b6c-... — First Test Bank
Seeding 24 GL accounts...   GL seed complete.
Seeding 41 permissions...   Permissions seed complete.
Seeding 9 transaction type configs...   Done.
Role created: SUPER_ADMIN
Granted 41 permissions to SUPER_ADMIN
Admin user created: admin@ftb.ng

=== Tenant onboarded successfully ===
Tenant ID   : 3f4a5b6c-...
Tenant Code : FTB001
Sort Code   : 000001
Admin Email : admin@ftb.ng
```

**Save the Tenant ID** — you may need it for database queries and debugging.

---

### Step 8 — Start the application

```bash
npm run start:dev
```

This starts NestJS in watch mode. Any file you save will hot-reload the application
automatically without restarting.

**The application is ready when you see:**
```
[NestApplication] Nest application successfully started +Xms
```

**Your local URLs:**

| URL | Purpose |
|-----|---------|
| `http://localhost:3000/api/v1` | REST API — all endpoints |
| `http://localhost:3000/api/docs` | Swagger interactive docs (development only) |
| `http://localhost:3000/api/v1/health` | Health check — no auth required |
| `http://localhost:15672` | RabbitMQ management UI (guest/guest) |
| `http://localhost:9001` | MinIO console (minioadmin/minioadmin) |

**Verify the app is running:**
```bash
curl http://localhost:3000/api/v1/health
# Expected: {"status":"ok","info":{"database":{"status":"up"}}}
```

---

### Step 9 — Run the test suite

```bash
# Unit tests — fast, no database required
npx jest

# With coverage report
npx jest --coverage
```

All 48 tests should pass. If any fail, check that `npm install` completed without errors.

---

## Part 3 — Online Setup on Railway

**Use this for:** Sharing a live URL with teammates, QA testers, or a frontend developer.  
**Cost:** $5 free trial credit. After that, approximately $10–15/month.  
**Time:** 25–30 minutes.

Railway provides automatic deployments on every push to GitHub, a managed PostgreSQL
database, TLS certificates, and a public `*.railway.app` domain.

---

### Step 1 — Get a free RabbitMQ from CloudAMQP

Railway does not provide a managed RabbitMQ service, so you use CloudAMQP's free tier.

1. Go to **https://www.cloudamqp.com** → click **Sign Up**
2. Verify your email
3. Click **Create New Instance**
4. Name it `cba-dev` (or anything you like)
5. Select the **Little Lemur** plan — this is the permanent free tier:
   - 1 million messages per month
   - Maximum 20 concurrent connections
   - 1 queue per connection
6. Click **Select Region** → choose the region closest to where you will deploy on Railway
   (for example: EU West if you plan to use Railway's EU region)
7. Click **Create Instance**
8. On the instance detail page, copy the **AMQP URL** — it looks like:
   ```
   amqp://abc:xyz123@puffin.rmq2.cloudamqp.com/abc
   ```

**Save this URL.** You will paste it into Railway in Step 5.

---

### Step 2 — Create a Railway account

1. Go to **https://railway.app** → click **Start a New Project**
2. Click **Sign in with GitHub** and authorise Railway
   (use the GitHub account that owns `donaina/cba`)
3. Click **New Project** on the dashboard

---

### Step 3 — Add a PostgreSQL database to your Railway project

Create the database first so Railway can automatically connect it to your app.

1. Inside your Railway project, click **+ New**
2. Select **Database → Add PostgreSQL**
3. Railway provisions a Postgres 16 instance — this takes about 30 seconds
4. Once it appears, click on the Postgres service → **Variables** tab
5. You will see `DATABASE_URL` listed — Railway injects this into your app automatically.
   Copy it anyway for use in Step 6 (applying the schema).

---

### Step 4 — Connect your GitHub repository

1. In your Railway project, click **+ New → GitHub Repo**
2. Search for and select **donaina/cba**
3. When Railway asks for a **Root Directory**, enter:
   ```
   core-banking-app
   ```
   This tells Railway the NestJS project is in a subdirectory, not the repo root.
4. Click **Deploy Now**

The first deploy will likely fail — this is expected because the environment variables
are not set yet. Continue to Step 5.

---

### Step 5 — Configure the build and start commands

1. Click on your app service → **Settings** tab
2. Set the following:

   | Setting | Value |
   |---------|-------|
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `node dist/main.js` |

3. Save the settings

---

### Step 6 — Set environment variables

1. Click on your app service → **Variables** tab → **Raw Editor**
2. Paste the block below, filling in the values marked with `<...>`:

```env
NODE_ENV=production
PORT=3000

# JWT secrets — generate two values using:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<64-character hex string>
JWT_REFRESH_SECRET=<different 64-character hex string>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# RabbitMQ — from CloudAMQP Step 1
RABBITMQ_URL=amqp://abc:xyz123@puffin.rmq2.cloudamqp.com/abc

# MinIO — leave blank for now (document endpoints will fail but everything else works)
MINIO_ENDPOINT=
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=core-banking

# Puppeteer (PDF generation)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# All sandboxed — no real external API calls
NIBSS_SANDBOX=true
TERMII_SANDBOX=true
SENDGRID_SANDBOX=true
CREDIT_BUREAU_SANDBOX=true
```

> **Note:** Do not add `DATABASE_URL` — Railway injects it automatically from the
> Postgres service you created in Step 3.

3. Click **Save** — Railway triggers a new deployment automatically

---

### Step 7 — Wait for the deployment to succeed

1. Click on your app service → **Deployments** tab
2. Watch the build logs in real time
3. A successful deployment ends with:
   ```
   [NestApplication] Nest application successfully started
   ```

If the build fails, look at the error in the logs. Common causes:
- Missing environment variable (the app validates all required vars on startup)
- `npm install` failed due to a network issue (click **Redeploy** to retry)

---

### Step 8 — Get a public URL

1. Click on your app service → **Settings** → **Networking** → **Public Domain**
2. Click **Generate Domain** — you get a URL like:
   ```
   https://cba-production-xxxx.up.railway.app
   ```
3. Verify the app is running:
   ```bash
   curl https://cba-production-xxxx.up.railway.app/api/v1/health
   # Expected: {"status":"ok"}
   ```

---

### Step 9 — Apply the database schema

The Railway Postgres database is empty — the tables need to be created. You will do this
from your **local machine** using Railway's external connection URL.

1. In your Railway project, click on the **Postgres service** → **Connect** tab
2. Copy the **External Connection URL** (the one that includes the `rlwy.net` hostname)
3. On your local machine, inside `core-banking-app/`, run:

```bash
DATABASE_URL="postgresql://postgres:xxxx@monorail.proxy.rlwy.net:12345/railway" \
  npx prisma db push
```

Expected output ends with:
```
🚀  Your database is now in sync with your Prisma schema.
```

---

### Step 10 — Create the first tenant on Railway

Using the same external database URL:

```bash
DATABASE_URL="postgresql://postgres:xxxx@monorail.proxy.rlwy.net:12345/railway" \
  npx ts-node scripts/onboard-tenant.ts \
    --name "Test Bank" \
    --shortName "TST" \
    --tenantCode "TST001" \
    --sortCode "000001" \
    --email "admin@testbank.ng" \
    --password "Admin@1234"
```

**Verify login works on your live URL:**
```bash
curl -s -X POST https://cba-production-xxxx.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@testbank.ng","password":"Admin@1234","tenantCode":"TST001"}' \
  | jq .accessToken
```

You are now live. Every subsequent push to the `main` branch on GitHub will automatically
redeploy the application.

---

## Part 4 — Online Setup on Render

**Use this for:** A free hosted environment with no credit card required.  
**Cost:** Free tier available.  
**Limitations:** Free apps sleep after 15 minutes of inactivity (first request after sleep
takes 20–30 seconds to wake up). Free Postgres expires after 90 days.  
**Time:** 30–35 minutes.

---

### Step 1 — Get a free RabbitMQ from CloudAMQP

Same as Railway Step 1. Create a free Little Lemur instance and copy the AMQP URL.

---

### Step 2 — Create a Render account

1. Go to **https://render.com** → click **Get Started for Free**
2. Sign up with GitHub — use the `donaina` account
3. Verify your email if prompted

---

### Step 3 — Create a PostgreSQL database on Render

1. In your Render dashboard, click **New → PostgreSQL**
2. Fill in:

   | Field | Value |
   |-------|-------|
   | **Name** | `cba-postgres` |
   | **Region** | Oregon (US West) or Frankfurt (EU) — pick closest to your users |
   | **PostgreSQL Version** | 16 |
   | **Plan** | Free |

3. Click **Create Database**
4. Once created, click on the database → **Info** tab
5. Copy both the **Internal Database URL** (for the app) and the **External Database URL**
   (for running `prisma db push` from your laptop)

---

### Step 4 — Create the web service

1. Click **New → Web Service**
2. Select **Build and deploy from a Git repository → Connect GitHub**
3. Choose **donaina/cba**
4. Fill in the service settings:

   | Field | Value |
   |-------|-------|
   | **Name** | `cba-api` |
   | **Root Directory** | `core-banking-app` |
   | **Runtime** | Node |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `node dist/main.js` |
   | **Plan** | Free |

---

### Step 5 — Set environment variables on Render

In the **Environment** section (during creation, or under the Environment tab afterward):

```env
NODE_ENV=production
PORT=10000

JWT_SECRET=<64-char hex secret>
JWT_REFRESH_SECRET=<different 64-char hex secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Internal Database URL from Render Postgres (Step 3)
DATABASE_URL=postgresql://cba_postgres_user:xxxx@dpg-xxxx-a.oregon-postgres.render.com/cba_postgres

# CloudAMQP from Step 1
RABBITMQ_URL=amqp://abc:xyz123@puffin.rmq2.cloudamqp.com/abc

MINIO_ENDPOINT=
MINIO_BUCKET=core-banking

NIBSS_SANDBOX=true
TERMII_SANDBOX=true
SENDGRID_SANDBOX=true
CREDIT_BUREAU_SANDBOX=true
```

> **Important:** Render's free tier requires `PORT=10000`. Render's load balancer
> routes external HTTPS traffic to this internal port.

Click **Create Web Service**. The first deploy starts automatically.

---

### Step 6 — Apply schema and create the tenant

Use the **External Database URL** (not the internal one) from Step 3:

```bash
# Apply database schema
DATABASE_URL="postgresql://cba_postgres_user:xxxx@dpg-xxxx-a.oregon-postgres.render.com/cba_postgres" \
  npx prisma db push

# Create the first tenant
DATABASE_URL="postgresql://cba_postgres_user:xxxx@dpg-xxxx-a.oregon-postgres.render.com/cba_postgres" \
  npx ts-node scripts/onboard-tenant.ts \
    --name "Test Bank" \
    --shortName "TST" \
    --tenantCode "TST001" \
    --sortCode "000001" \
    --email "admin@testbank.ng" \
    --password "Admin@1234"
```

Your Render app URL will be `https://cba-api.onrender.com`. Verify:
```bash
curl https://cba-api.onrender.com/api/v1/health
```

---

## Part 5 — First-Time Configuration

Run these steps once after any environment (local, Railway, or Render) is up and running.
You need an access token from a successful login first — see Part 6 Step 1.

```bash
# Set these once — replace with your actual URL and token
export BASE="http://localhost:3000/api/v1"   # or your Railway/Render URL
export TOKEN="eyJhbGciOi..."                 # from login
```

---

### 5.1 — Create a savings product

Customers cannot open accounts without a product. A product defines the interest rate,
minimum balance, and other rules for a type of account.

```bash
export SAVINGS_PRODUCT_ID=$(curl -s -X POST $BASE/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Regular Savings",
    "code": "SAV001",
    "productType": "SAVINGS",
    "interestRate": "0.04",
    "minimumBalance": "500",
    "isActive": true
  }' | jq -r .id)

echo "Savings product ID: $SAVINGS_PRODUCT_ID"
```

---

### 5.2 — Create a loan product

```bash
export LOAN_PRODUCT_ID=$(curl -s -X POST $BASE/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Business Term Loan",
    "code": "LOAN001",
    "productType": "LOAN",
    "interestRate": "0.24",
    "minimumBalance": "10000",
    "maximumBalance": "5000000",
    "minTenorDays": 30,
    "maxTenorDays": 365,
    "isActive": true
  }' | jq -r .id)

echo "Loan product ID: $LOAN_PRODUCT_ID"
```

---

### 5.3 — (Optional) Configure maker-checker approval thresholds

Maker-checker requires a second person to approve high-value transactions. Configure
the threshold — for example, require approval for cash withdrawals above ₦500,000:

```bash
curl -s -X POST $BASE/admin/maker-checker-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "TRANSACTIONS",
    "action": "OTC_WITHDRAWAL",
    "requiresApprovalAbove": "500000",
    "channels": ["OTC"],
    "ttlMinutes": 60
  }' | jq .
```

`ttlMinutes: 60` means the approval request expires after 60 minutes if not acted on.

---

## Part 6 — Testing the API

### 6.1 — Login and get an access token

This is the first call you make in every test session. The token returned is required
as a header on all other endpoints.

```bash
export BASE="http://localhost:3000/api/v1"   # change to your online URL if needed

# Login
RESPONSE=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ftb.ng",
    "password": "Admin@1234",
    "tenantCode": "FTB001"
  }')

echo $RESPONSE | jq .

# Export the token for use in subsequent requests
export TOKEN=$(echo $RESPONSE | jq -r .accessToken)
export REFRESH_TOKEN=$(echo $RESPONSE | jq -r .refreshToken)
```

The access token expires after 15 minutes. Refresh it without re-logging in:

```bash
export TOKEN=$(curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" | jq -r .accessToken)
```

---

### 6.2 — Core banking flow (end to end)

This sequence tests the complete flow: create customer → open account → deposit →
check balance → withdraw → get statement.

**Step 1: Create a customer**
```bash
export CUSTOMER_ID=$(curl -s -X POST $BASE/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerType": "INDIVIDUAL",
    "firstName": "Amina",
    "lastName": "Bello",
    "email": "amina@example.ng",
    "phone": "08012345678",
    "bvn": "12345678901"
  }' | jq -r .id)

echo "Customer ID: $CUSTOMER_ID"
```

**Step 2: Open a savings account**
```bash
export ACCOUNT_ID=$(curl -s -X POST $BASE/accounts/savings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"productId\": \"$SAVINGS_PRODUCT_ID\"
  }" | jq -r .id)

echo "Account ID: $ACCOUNT_ID"
```

**Step 3: Deposit ₦100,000**

> The `Idempotency-Key` header is **required** on all financial endpoints. Use a unique
> value per transaction (e.g. a UUID). If you send the same request twice with the same
> key, the second attempt returns the original response without processing again — this
> prevents accidental double-charges.

```bash
curl -s -X POST $BASE/transactions/deposit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: dep-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": \"$ACCOUNT_ID\",
    \"amount\": \"100000\",
    \"narration\": \"Opening deposit\"
  }" | jq '{id, reference, status}'
```

**Step 4: Check the balance**
```bash
curl -s $BASE/accounts/$ACCOUNT_ID/balance \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected response:
```json
{
  "accountNumber": "0000010001",
  "currentBalance": "100000.0000",
  "availableBalance": "100000.0000",
  "ledgerBalance": "100000.0000"
}
```

**Step 5: Withdraw ₦20,000**
```bash
curl -s -X POST $BASE/transactions/withdraw \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: wdr-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": \"$ACCOUNT_ID\",
    \"amount\": \"20000\",
    \"narration\": \"Cash withdrawal\"
  }" | jq '{id, reference, status}'
```

**Step 6: Get account statement**
```bash
curl -s "$BASE/reports/statement?accountNumber=0000010001&from=2026-01-01&to=2026-12-31" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

### 6.3 — Using Swagger UI (browser-based)

Swagger is a built-in interactive API explorer available in development mode.

1. Open `http://localhost:3000/api/docs`
   (or your Railway/Render URL with `/api/docs`, if you set `NODE_ENV=development`)
2. Click the **Authorize** button (lock icon, top right)
3. First, use the **`POST /api/v1/auth/login`** endpoint in Swagger to get a token
4. Copy the `accessToken` from the response
5. Paste it into the Authorize dialog → click **Authorize**
6. Now every request you make in Swagger will include your token automatically
7. Browse any endpoint, fill in the fields, and click **Execute** to test it

---

### 6.4 — Using Postman

Postman lets you import the entire API as a collection with one click.

1. Open Postman → click **Import** → select the **Link** tab
2. Paste: `http://localhost:3000/api/docs-json`
   (Swagger generates a full OpenAPI JSON spec at this URL)
3. Click **Import** — Postman creates a complete collection with every endpoint

**Set up automatic token handling:**

1. Create a Postman **Environment** with two variables:
   - `base_url` → `http://localhost:3000/api/v1`
   - `token` → *(leave empty)*

2. Open the Login request → **Tests** tab → add:
   ```javascript
   pm.environment.set("token", pm.response.json().accessToken);
   pm.environment.set("refresh_token", pm.response.json().refreshToken);
   ```

3. In every other request, set the Authorization header to:
   `Bearer {{token}}`

Now run Login once and all other requests will use the token automatically.

---

## Part 7 — Environment Variables Reference

Complete list of every variable the application reads.

| Variable | Required | Default | What it does |
|----------|----------|---------|--------------|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string. Format: `postgresql://user:pass@host:port/dbname` |
| `JWT_SECRET` | **Yes** | — | Signs and verifies access tokens. Must be at least 32 characters. Changing this invalidates all active sessions. |
| `JWT_REFRESH_SECRET` | **Yes** | — | Signs and verifies refresh tokens. Must differ from `JWT_SECRET`. |
| `JWT_EXPIRES_IN` | No | `15m` | How long an access token is valid. Examples: `15m`, `1h`, `7d` |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `7d` | How long a refresh token is valid before the user must log in again |
| `PORT` | No | `3000` | The port the HTTP server listens on. Render free tier requires `10000`. |
| `NODE_ENV` | No | `development` | Set to `production` on cloud environments. Disables Swagger in production mode. |
| `RABBITMQ_URL` | No | — | AMQP connection string for RabbitMQ. Without this, the notification consumer fails on startup. |
| `MINIO_ENDPOINT` | No | — | MinIO or S3 hostname. Without this, file upload/download endpoints throw errors. |
| `MINIO_PORT` | No | `9000` | Port for MinIO. Not needed when using AWS S3 (which uses HTTPS on 443). |
| `MINIO_USE_SSL` | No | `false` | Set to `true` for AWS S3 or any MinIO behind HTTPS. |
| `MINIO_ACCESS_KEY` | No | — | MinIO or S3 access key |
| `MINIO_SECRET_KEY` | No | — | MinIO or S3 secret key |
| `MINIO_BUCKET` | No | `core-banking` | Name of the bucket where all files are stored |
| `PUPPETEER_EXECUTABLE_PATH` | No | — | Path to Chromium binary used for PDF statement generation. Set to `/usr/bin/chromium-browser` on Linux Docker containers. |
| `NIBSS_SANDBOX` | No | `true` | `true` = log NIP/BVN payloads to console, no real NIBSS calls |
| `NIBSS_BASE_URL` | No | — | NIBSS API base URL (required when `NIBSS_SANDBOX=false`) |
| `TERMII_SANDBOX` | No | `true` | `true` = log SMS payloads, no actual messages sent |
| `TERMII_API_KEY` | No | — | Termii API key (required when `TERMII_SANDBOX=false`) |
| `TERMII_SENDER_ID` | No | — | Your registered Termii SMS sender ID |
| `SENDGRID_SANDBOX` | No | `true` | `true` = log email payloads, no actual emails sent |
| `SENDGRID_API_KEY` | No | — | SendGrid API key (required when `SENDGRID_SANDBOX=false`) |
| `SENDGRID_FROM_EMAIL` | No | — | Verified sender email address for outgoing emails |
| `CREDIT_BUREAU_SANDBOX` | No | `true` | `true` = return a mock credit report instead of calling CRC |
| `CREDIT_BUREAU_API_KEY` | No | — | CRC credit bureau API key (required when sandbox is false) |
| `AML_WEBHOOK_SECRET` | No | — | HMAC-SHA256 secret for verifying callbacks from the AML screening vendor |
| `CORS_ORIGINS` | No | `*` | Comma-separated list of allowed origins. Example: `https://app.yourbank.ng,https://admin.yourbank.ng` |

---

## Part 8 — Troubleshooting

### The application fails to start

| Error message | Cause | Fix |
|---------------|-------|-----|
| `JWT_SECRET must be at least 32 characters` | The placeholder value is still in `.env` | Generate a proper secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `Cannot find module '@prisma/client'` | Prisma client not generated | `npm install` then `npx prisma generate` |
| `P1001: Can't reach database server` | PostgreSQL not running | `docker-compose up -d postgres` — wait 30 seconds |
| `ECONNREFUSED 127.0.0.1:5672` | RabbitMQ not running | `docker-compose up -d rabbitmq` |
| `relation "Account" does not exist` | Schema not applied to the database | `npx prisma db push` |

---

### API returns errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` on every request | Access token expired or missing | Re-login to get a new token. Check that your request includes `Authorization: Bearer <token>` |
| `403 Forbidden` | User does not have the required permission | The SUPER_ADMIN role has all permissions. For other roles, add the missing permission via `PATCH /api/v1/auth/roles/:roleId/permissions` |
| `Journal does not balance` | A service method has a bug in its GL entry amounts | The sum of DEBIT entries must exactly equal the sum of CREDIT entries. This is a code bug, not a configuration issue. |
| `GL account 'X' is not a DETAIL-level account` | Trying to post to a summary or header GL account | Only DETAIL-level accounts accept postings. Check the GL chart with `GET /api/v1/gl` |
| `Insufficient available balance` | Account balance too low for the transaction | Check the balance with `GET /api/v1/accounts/:id/balance` |
| `P2002: Unique constraint failed on tenantCode` | Tenant already exists | Use a different `--tenantCode` in the onboard script |

---

### Docker errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot connect to Docker daemon` | Docker Desktop is not running | Open Docker Desktop and wait for it to fully start |
| `port is already allocated` | Another process is using port 5432, 5672, or 9000 | Find the process: `sudo lsof -i :5432` — kill it or change the port in `docker-compose.yml` |
| `permission denied while trying to connect to the Docker daemon` | Your user is not in the docker group | `sudo usermod -aG docker $USER` then log out and back in |
| `no space left on device` | Docker images filling your disk | `docker system prune -a` removes unused images and containers |
| A container shows `Up (unhealthy)` | Service health check is failing | `docker-compose logs <service-name>` — read the log for the specific error |

---

### Railway / Render errors

| Error | Cause | Fix |
|-------|-------|-----|
| Build fails: `ENOENT: dist/main.js` | The build command didn't run or failed silently | Check build logs. Ensure Build Command is exactly `npm install && npm run build` |
| App starts but all requests return 502 | Wrong `PORT` variable | Railway: use `PORT=3000`. Render: use `PORT=10000` |
| `P2002: Unique constraint failed` when onboarding tenant | Schema applied before previous tenant data was cleaned | Use a different `--tenantCode`, or reset the database and reapply the schema |
| Swagger not showing on live URL | `NODE_ENV=production` disables Swagger | Set `NODE_ENV=development` temporarily, or test via curl or Postman instead |
| App crashes every 15 min on Render | Free tier sleep — not a crash | Render free apps sleep after inactivity. Upgrade to a paid plan or use Railway instead |
