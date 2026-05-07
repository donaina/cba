# Deployment & Testing Guide

> **Audience:** Developers, QA engineers, and DevOps engineers setting up the Core Banking Application
> for the first time — whether locally on a laptop or in a cloud environment.

---

## Table of Contents

1. [Understanding the Architecture](#1-understanding-the-architecture)
2. [Local Deployment](#2-local-deployment)
3. [Online Deployment — Railway](#3-online-deployment--railway)
4. [Online Deployment — Render](#4-online-deployment--render)
5. [Online Deployment — Oracle Cloud Free VPS](#5-online-deployment--oracle-cloud-free-vps)
6. [Post-Deployment Setup (all environments)](#6-post-deployment-setup-all-environments)
7. [Testing the API](#7-testing-the-api)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Understanding the Architecture

Before setting up any environment, it helps to understand what services the application needs and why.

```
┌─────────────────────────────────────────────────────┐
│                   Your HTTP Client                  │
│              (Browser / Postman / curl)             │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS :3000
┌────────────────────────▼────────────────────────────┐
│               NestJS API Application                │
│  • REST API (25 modules)                            │
│  • JWT Authentication                               │
│  • Multi-tenant isolation (per-request TenantContext│
│  • Maker-checker, RBAC, Idempotency middleware      │
└──────┬─────────────┬──────────────┬─────────────────┘
       │             │              │
       │ SQL         │ AMQP         │ S3 API
┌──────▼──────┐ ┌────▼──────┐ ┌────▼────────────┐
│ PostgreSQL  │ │ RabbitMQ  │ │ MinIO           │
│             │ │           │ │ (or AWS S3)     │
│ All tenant  │ │ Async     │ │ KYC documents   │
│ data — GL,  │ │ notif.    │ │ Statements PDF  │
│ accounts,   │ │ queue +   │ │ Bank logo       │
│ loans, etc. │ │ dead-letter│ │                │
└─────────────┘ └───────────┘ └─────────────────┘
```

### What each service does

| Service | Role | Required? |
|---------|------|-----------|
| **NestJS app** | The API itself — handles all business logic | Yes |
| **PostgreSQL** | Stores everything: tenants, customers, accounts, transactions, GL | Yes |
| **RabbitMQ** | Delivers async notifications (SMS/email). Failures go to a dead-letter queue | Yes for notifications; app starts without it but notification endpoints fail |
| **MinIO** | Stores binary files: KYC documents, statement PDFs, bank logos | Yes for file uploads; API works without it but document/branding endpoints fail |

### Sandbox mode

All third-party integrations (NIBSS, Termii, SendGrid, CRC, AML) have a **sandbox flag** in `.env`.
When `NIBSS_SANDBOX=true`, the service logs the outbound payload to the console instead of calling
the real external API. This means you can test the complete flow without any external accounts.

---

## 2. Local Deployment

**Best for:** Developers building or extending the application. Full control, fast iteration,
no cost.

**Time to first request:** ~15 minutes (excluding downloads).

### 2.1 Prerequisites

You need four tools installed on your machine. Here is what each one does and how to check
whether it is already installed.

#### Node.js 20 LTS

Node.js is the JavaScript runtime that executes the NestJS application.
Version 20 (LTS) is required because the codebase uses ES2023 features and some packages
require Node ≥ 18.

```bash
node --version
# Must output v20.x.x
```

**Install (macOS):**
```bash
brew install node@20
```

**Install (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Install (Windows):** Download from https://nodejs.org and run the installer.
Choose the LTS version.

---

#### Docker Desktop

Docker runs the supporting services (Postgres, RabbitMQ, MinIO) inside isolated containers
so you do not need to install them directly on your machine. Each container is like a small
virtual machine that only runs one service.

```bash
docker --version
# Must output Docker version 24.x or higher
```

**Install:** Download from https://www.docker.com/products/docker-desktop and install.
After installing, open the Docker Desktop app and wait until the whale icon in your menu bar
stops animating — this means Docker is ready.

> **Windows users:** Docker Desktop on Windows requires WSL2 (Windows Subsystem for Linux).
> The installer will prompt you to enable it if it is not already active.

---

#### Git

Git is used to clone the source code repository.

```bash
git --version
# Must output git version 2.x
```

**Install (macOS):** `brew install git`  
**Install (Ubuntu):** `sudo apt install git`  
**Install (Windows):** Download from https://git-scm.com

---

#### ts-node (for seed scripts only)

`ts-node` allows running TypeScript files directly without compiling them first.
It is needed to run the tenant onboarding script.

```bash
npm install -g ts-node
ts-node --version
```

---

### 2.2 Clone the repository

```bash
git clone https://github.com/donaina/cba.git
cd cba/core-banking-app
```

`core-banking-app/` is the NestJS project root. All subsequent commands in this local
section are run from inside this directory unless stated otherwise.

---

### 2.3 Install Node dependencies

```bash
npm install
```

This reads `package.json` and downloads all libraries the application needs (~800 packages).
It also automatically generates the Prisma client (TypeScript types for the database).

This takes 1–3 minutes depending on your internet speed.

---

### 2.4 Configure environment variables

The application reads configuration from a `.env` file in the project root.
A template with all available keys is provided:

```bash
cp .env.example .env
```

Now open `.env` in a text editor. You **must** set these two values — everything else
can stay as the defaults for local testing:

```env
JWT_SECRET=<a random string at least 32 characters long>
JWT_REFRESH_SECRET=<a different random string at least 32 characters long>
```

**Why are these needed?**
JWT (JSON Web Token) is how the API proves a user is who they say they are.
The `JWT_SECRET` is used to sign access tokens (15-minute lifetime).
The `JWT_REFRESH_SECRET` is used to sign refresh tokens (7-day lifetime).
If these are left as the default placeholder values, the app will refuse to start
with a validation error.

Generate two secrets using Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# run this twice — use the first output for JWT_SECRET, second for JWT_REFRESH_SECRET
```

The complete local `.env` will look like this:

```env
# Database — matches what docker-compose creates
DATABASE_URL=postgresql://cba_app:changeme_in_prod@localhost:5432/cba

# JWT — use the values you generated above
JWT_SECRET=a1b2c3d4e5f6...
JWT_REFRESH_SECRET=f6e5d4c3b2a1...
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# MinIO — local Docker container
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=core-banking

# RabbitMQ — local Docker container
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# All external services in sandbox mode (no real API calls)
NIBSS_SANDBOX=true
TERMII_SANDBOX=true
SENDGRID_SANDBOX=true
CREDIT_BUREAU_SANDBOX=true

# App
PORT=3000
NODE_ENV=development
```

---

### 2.5 Start the infrastructure services

This command starts Postgres, RabbitMQ, and MinIO as Docker containers running in the background
(`-d` means "detached" — they keep running even after you close the terminal).

```bash
docker-compose up -d postgres rabbitmq minio minio-init
```

**What each container does:**

- `postgres` — starts PostgreSQL on port 5432. The `init.sql` script runs automatically
  on first start: it creates the `cba` database, installs the `uuid-ossp` extension
  (for generating UUIDs), and creates the `cba_app` role with the right permissions.

- `rabbitmq` — starts RabbitMQ on port 5672. The management web UI runs on port 15672.

- `minio` — starts MinIO object storage on port 9000 (API) and 9001 (web console).

- `minio-init` — a one-time helper container that creates the `core-banking` bucket
  in MinIO. It exits automatically after creating the bucket.

**Verify all services are healthy:**

```bash
docker-compose ps
```

Expected output (wait ~30 seconds after starting):

```
NAME           STATUS          PORTS
cba_postgres   Up (healthy)    0.0.0.0:5432->5432/tcp
cba_rabbitmq   Up (healthy)    0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp
cba_minio      Up (healthy)    0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
```

If any service shows `Up (starting)`, wait another 30 seconds and run `docker-compose ps` again.
If a service shows `Up (unhealthy)` or `Exit`, check its logs:

```bash
docker-compose logs postgres   # replace "postgres" with the failing service name
```

---

### 2.6 Apply the database schema

The Prisma schema defines all 40+ database tables but they do not yet exist in Postgres.
This command creates all the tables:

```bash
npx prisma db push
```

**What this does:**  
Prisma reads every `.prisma` file in the `prisma/schemas/` directory, builds the full
schema, and compares it with what exists in the database. For a fresh database it creates
every table, index, and constraint. It also regenerates the TypeScript Prisma client
so your IDE has accurate type hints.

Expected output:
```
Prisma schema loaded from prisma.
Environment variables loaded from .env.
Datasource "db": PostgreSQL database "cba" at "localhost:5432"

🚀  Your database is now in sync with your Prisma schema.
✔ Generated Prisma Client (v7.x.x)
```

> **`db push` vs `migrate dev`:**  
> `db push` applies changes directly without creating migration files. This is fine for
> development. If you want a version-controlled migration history (recommended before
> going to production), use `npx prisma migrate dev --name init` instead. This creates
> a `prisma/migrations/` folder with SQL files you can review and commit.

---

### 2.7 Onboard the first tenant (bank)

The application is multi-tenant — each bank runs as an isolated tenant. Before anyone
can log in, at least one tenant must be created along with its chart of accounts,
permissions, and an admin user.

Run the onboarding script (replace the values with your own):

```bash
npx ts-node scripts/onboard-tenant.ts \
  --name "First Test Bank" \
  --shortName "FTB" \
  --tenantCode "FTB001" \
  --sortCode "000001" \
  --email "admin@ftb.ng" \
  --password "Admin@1234"
```

**Parameter explanation:**

| Parameter | What it is | Example |
|-----------|------------|---------|
| `--name` | Full legal name of the bank | "Sunrise Microfinance Bank" |
| `--shortName` | Abbreviation used in reports | "SunriseMFB" |
| `--tenantCode` | Unique code used at login | "SUNMFB" — users enter this when logging in |
| `--sortCode` | 6-digit CBN sort code used for NUBAN account number generation | "090123" |
| `--email` | Super-admin login email | "admin@sunrisemfb.ng" |
| `--password` | Super-admin password (change after first login) | "Admin@1234" |

**What the script creates:**

1. `Organisation` row — the bank entity with all its metadata
2. **24 GL system accounts** — the full chart of accounts (VAULT_CASH, SAVINGS_CONTROL, LOAN_PORTFOLIO, etc.)
3. **41 global permissions** — every permission code the RBAC system knows about
4. **9 transaction type configs** — fee and approval rules for each transaction category
5. `SUPER_ADMIN` role — with all 41 permissions assigned
6. Admin `User` — linked to the SUPER_ADMIN role

Expected output:
```
Organisation created: 3f4a5b6c... — First Test Bank
Seeding 24 GL accounts for tenant 3f4a5b6c...
GL seed complete.
Seeding 41 global permissions...
Permissions seed complete.
Seeding 9 transaction type configs for tenant 3f4a5b6c...
Transaction type configs seed complete.
Role created: 7d8e9f0a... — SUPER_ADMIN
Granted 41 permissions to SUPER_ADMIN
Admin user created: 1b2c3d4e... — admin@ftb.ng

=== Tenant onboarded successfully ===
Tenant ID   : 3f4a5b6c...
Tenant Code : FTB001
Sort Code   : 000001
Admin Email : admin@ftb.ng
```

Save the **Tenant ID** somewhere — you may need it for database queries or debugging.

---

### 2.8 Start the application

```bash
npm run start:dev
```

This starts NestJS in watch mode — any file you save triggers a hot reload automatically.

The application is ready when you see this line in the terminal:
```
[NestApplication] Nest application successfully started +Xms
```

**Available URLs:**

| URL | What it is |
|-----|-----------|
| `http://localhost:3000/api/v1` | REST API base URL |
| `http://localhost:3000/api/docs` | Swagger interactive API docs |
| `http://localhost:3000/api/v1/health` | Health check (no auth needed) |
| `http://localhost:15672` | RabbitMQ management UI (guest/guest) |
| `http://localhost:9001` | MinIO web console (minioadmin/minioadmin) |

---

### 2.9 Run the test suite

```bash
# Unit tests only (no database needed, runs in ~5 seconds)
npx jest

# End-to-end tests (requires Docker services running)
npx jest --config test/jest-e2e.json
```

---

## 3. Online Deployment — Railway

**Best for:** Teams that want a live URL they can share with stakeholders, QA testers,
or a frontend developer without managing servers.

**Cost:** Railway gives $5 of free trial credit. After that, the stack costs approximately
$10–15/month (app ~$5 + Postgres ~$5 + egress).

**Time to first request:** ~25 minutes.

**What Railway provides:** Automatic deploys on every `git push`, managed Postgres,
TLS certificates, and a public `*.railway.app` domain.

**What you bring:** A RabbitMQ URL from CloudAMQP (free tier).

---

### 3.1 Create a free CloudAMQP account (RabbitMQ)

Railway does not offer a managed RabbitMQ service, so we use CloudAMQP's free plan.

1. Go to https://www.cloudamqp.com and click **Sign Up**.
2. Complete email verification.
3. Click **Create New Instance**.
4. Give it a name (e.g. "cba-dev").
5. Select the **Little Lemur** plan — this is the free tier (1 million messages/month,
   max 20 connections).
6. Click **Select Region** → choose the region closest to where you will deploy Railway
   (e.g. EU West or US East).
7. Click **Create Instance**.
8. On the instance details page, copy the **AMQP URL**. It looks like:
   `amqp://abc:xyz123@puffin.rmq2.cloudamqp.com/abc`

Keep this URL — you will paste it into Railway as an environment variable.

---

### 3.2 Sign up for Railway

1. Go to https://railway.app and click **Start a New Project**.
2. Select **Sign in with GitHub** and authorise Railway to access your GitHub account.
   Use the same GitHub account that owns `donaina/cba`.
3. Railway shows you a welcome screen. Click **New Project**.

---

### 3.3 Add a PostgreSQL database

Before deploying the app, create the database so Railway can wire up the connection
string automatically.

1. In your Railway project dashboard, click **+ New**.
2. Select **Database → Add PostgreSQL**.
3. Railway provisions a Postgres 16 instance in about 30 seconds.
4. Click on the Postgres service that appeared, then go to the **Variables** tab.
5. You will see `DATABASE_URL` listed — Railway will automatically inject this into
   any app service in the same project. Copy it anyway for use in Step 3.8.

---

### 3.4 Deploy the application from GitHub

1. In your Railway project, click **+ New → GitHub Repo**.
2. Search for and select **donaina/cba**.
3. Railway asks for a **Root Directory** — enter: `core-banking-app`
   (this tells Railway the NestJS project is in that subdirectory, not the repo root).
4. Click **Deploy Now**. Railway detects that this is a Node.js project.

The first deploy will likely fail — that is expected because you have not set the
environment variables yet. Continue to the next step.

---

### 3.5 Set the build and start commands

Click on your app service → **Settings** tab.

Set:
- **Build Command:** `npm install && npm run build`
- **Start Command:** `node dist/main.js`
- **Watch Paths:** `core-banking-app/**` (so deploys only trigger on app changes)

---

### 3.6 Set environment variables

Click on your app service → **Variables** tab → **Raw Editor**.
Paste and fill in the following:

```env
NODE_ENV=production
PORT=3000

# JWT — generate two secrets as described in Section 2.4
JWT_SECRET=<your 64-char hex secret>
JWT_REFRESH_SECRET=<your second 64-char hex secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# RabbitMQ — from CloudAMQP (Section 3.1)
RABBITMQ_URL=amqp://abc:xyz123@puffin.rmq2.cloudamqp.com/abc

# MinIO — skip for now (file uploads won't work, but all other API endpoints will)
MINIO_ENDPOINT=
MINIO_PORT=
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=core-banking

# Sandbox integrations
NIBSS_SANDBOX=true
TERMII_SANDBOX=true
SENDGRID_SANDBOX=true
CREDIT_BUREAU_SANDBOX=true
```

**Note:** `DATABASE_URL` is automatically injected by Railway from the Postgres service —
you do not need to add it manually.

Click **Save**. Railway triggers a new deploy automatically.

---

### 3.7 Wait for the deployment to succeed

Click on your app service → **Deployments** tab. You will see the build logs in real time.

A successful deploy ends with:
```
[NestApplication] Nest application successfully started
```

If it fails, check the logs for the specific error. Common causes at this stage are a
missing or malformed environment variable.

---

### 3.8 Get the public URL and apply the schema

Click on your app service → **Settings → Networking → Public Domain**. Click **Generate Domain**.
You get a URL like `https://cba-production-xxxx.up.railway.app`.

Test the health endpoint:
```bash
curl https://cba-production-xxxx.up.railway.app/api/v1/health
# Should return: { "status": "ok" }
```

Now apply the database schema. Go to your Railway **Postgres service → Connect tab**
and copy the **External Connection URL** (this is accessible from your local machine).

Run from your local terminal (inside `core-banking-app/`):

```bash
DATABASE_URL="postgresql://postgres:xxxx@monorail.proxy.rlwy.net:12345/railway" \
  npx prisma db push
```

---

### 3.9 Onboard the first tenant on Railway

Using the same external Postgres URL from above:

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

---

### 3.10 Test your live deployment

```bash
# Login
curl -s -X POST https://cba-production-xxxx.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@testbank.ng","password":"Admin@1234","tenantCode":"TST001"}' | jq .
```

Every subsequent push to the `main` branch on GitHub will automatically redeploy the app.

---

## 4. Online Deployment — Render

**Best for:** Teams that need a free tier with no credit card required upfront.

**Cost:** Free tier available. The free app service sleeps after 15 minutes of inactivity
(first request after sleep takes 20–30 seconds to wake up). Postgres free tier expires after
90 days.

**Time to first request:** ~30 minutes.

---

### 4.1 Create a CloudAMQP account

Same as Railway Step 3.1 — create a free CloudAMQP instance and copy the AMQP URL.

---

### 4.2 Sign up for Render

1. Go to https://render.com and click **Get Started for Free**.
2. Sign up with GitHub using the `donaina` account.
3. Verify your email if prompted.

---

### 4.3 Create a PostgreSQL database on Render

1. In your Render dashboard, click **New → PostgreSQL**.
2. Configure:
   - **Name:** `cba-postgres`
   - **Region:** Oregon (US West) or Frankfurt (EU) — choose the closest to your users
   - **PostgreSQL Version:** 16
   - **Plan:** Free
3. Click **Create Database**.
4. Once created, click on the database → **Info** tab.
5. Copy the **External Database URL** — you will need it for schema setup and the
   internal URL for the app's environment variable.

---

### 4.4 Deploy the application on Render

1. Click **New → Web Service**.
2. Connect your GitHub account and select **donaina/cba**.
3. Configure:
   - **Name:** `cba-api`
   - **Root Directory:** `core-banking-app`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/main.js`
   - **Plan:** Free

---

### 4.5 Set environment variables on Render

In the **Environment** section during setup (or under Environment after creation), add:

```
NODE_ENV=production
PORT=10000

JWT_SECRET=<your 64-char hex secret>
JWT_REFRESH_SECRET=<your second 64-char hex secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

DATABASE_URL=<Internal Database URL from Render Postgres — Step 4.3>
RABBITMQ_URL=<CloudAMQP AMQP URL from Step 4.1>

MINIO_ENDPOINT=
MINIO_BUCKET=core-banking

NIBSS_SANDBOX=true
TERMII_SANDBOX=true
SENDGRID_SANDBOX=true
CREDIT_BUREAU_SANDBOX=true
```

> **Important:** Render uses port `10000` internally on the free plan — set `PORT=10000`.
> Render's load balancer handles routing to this port from the public HTTPS URL.

Click **Create Web Service**. The first deploy starts automatically.

---

### 4.6 Apply schema and onboard tenant

Using the **External Database URL** from Step 4.3 (not the internal one):

```bash
DATABASE_URL="postgresql://cba_postgres_user:xxxx@dpg-xxxx-a.oregon-postgres.render.com/cba_postgres" \
  npx prisma db push

DATABASE_URL="postgresql://cba_postgres_user:xxxx@dpg-xxxx-a.oregon-postgres.render.com/cba_postgres" \
  npx ts-node scripts/onboard-tenant.ts \
    --name "Test Bank" --shortName "TST" --tenantCode "TST001" \
    --sortCode "000001" --email "admin@testbank.ng" --password "Admin@1234"
```

Your Render app URL will be `https://cba-api.onrender.com`. Test with:

```bash
curl https://cba-api.onrender.com/api/v1/health
```

---

## 5. Online Deployment — Oracle Cloud Free VPS

**Best for:** Teams who want a permanent free environment with no sleeping, no expiry,
and full Docker control — identical to a local setup but accessible online.

**Cost:** Free forever (Oracle Always Free tier). Requires a credit card for account
verification but is never charged for Always Free resources.

**Time to first request:** ~45 minutes.

---

### 5.1 Create an Oracle Cloud account

1. Go to https://cloud.oracle.com and click **Start for free**.
2. Fill in your details. When asked for a **Home Region**, choose the one nearest to you
   (this cannot be changed later).
3. Enter credit card details (for identity verification only — Oracle will not charge you
   for Always Free resources).
4. Complete email and phone verification.

---

### 5.2 Create a free virtual machine

1. Log into the Oracle Cloud Console.
2. Click the hamburger menu → **Compute → Instances → Create Instance**.
3. Configure:
   - **Name:** `cba-server`
   - **Image:** Oracle Linux 9 (or Ubuntu 22.04 — click **Change Image** to switch)
   - **Shape:** Click **Change Shape** → Select **VM.Standard.E2.1.Micro** (Always Free, 1 OCPU, 1 GB RAM)
   - **Add SSH key:** Click **Generate a key pair** → Download both keys. Keep the private key safe.
4. Click **Create**. The VM will be provisioned in about 2 minutes.
5. Once the instance shows a green dot (Running), note down the **Public IP Address**.

---

### 5.3 Open firewall ports

Oracle Cloud blocks all ports by default. You need to open port 3000 (and optionally 15672 and 9001 for monitoring).

1. Click on your instance → scroll down to **Primary VNIC** → click the **Subnet** link.
2. Click **Default Security List → Add Ingress Rules**.
3. Add rule:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP
   - Destination Port Range: `3000`
4. Click **Add Ingress Rules**.
5. Optionally add rules for ports `15672` (RabbitMQ UI) and `9001` (MinIO console).

---

### 5.4 SSH into the VM and install Docker

```bash
# From your local machine (replace with your actual key path and IP)
ssh -i ~/Downloads/ssh-key-xxxx.key opc@<your-public-ip>
```

Once connected:

```bash
# Update packages
sudo dnf update -y   # Oracle Linux / Amazon Linux
# OR for Ubuntu:
# sudo apt update && sudo apt upgrade -y

# Install Docker
sudo dnf install -y docker   # Oracle Linux
# OR for Ubuntu:
# sudo apt install -y docker.io docker-compose

# Start Docker and enable it to start on boot
sudo systemctl start docker
sudo systemctl enable docker

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Install Git
sudo dnf install -y git   # Oracle Linux
# sudo apt install -y git   # Ubuntu

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -   # Oracle Linux
sudo dnf install -y nodejs
# OR for Ubuntu:
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
# sudo apt-get install -y nodejs

# Install ts-node globally
npm install -g ts-node typescript
```

---

### 5.5 Clone the repo and configure

```bash
git clone https://github.com/donaina/cba.git
cd cba/core-banking-app

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env   # or use vim
```

In `.env`, set the following (the rest of the file stays as the defaults):

```env
DATABASE_URL=postgresql://cba_app:changeme_in_prod@localhost:5432/cba
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_REFRESH_SECRET=<run again for a second value>
```

Save and close.

---

### 5.6 Start all services with Docker Compose

```bash
docker-compose up -d postgres rabbitmq minio minio-init

# Check that all services are healthy
docker-compose ps
```

Wait ~30 seconds, then run:

```bash
# Apply the database schema
npx prisma db push

# Onboard the first tenant
npx ts-node scripts/onboard-tenant.ts \
  --name "Test Bank" --shortName "TST" --tenantCode "TST001" \
  --sortCode "000001" --email "admin@testbank.ng" --password "Admin@1234"
```

---

### 5.7 Run the application

```bash
# Build once
npm run build

# Start with pm2 (process manager — keeps app running after SSH disconnect)
npm install -g pm2
pm2 start dist/main.js --name cba-api
pm2 startup   # follow the printed instructions to enable auto-start on reboot
pm2 save
```

Your API is now live at `http://<your-public-ip>:3000/api/v1`.

Test it:
```bash
curl http://<your-public-ip>:3000/api/v1/health
```

---

## 6. Post-Deployment Setup (all environments)

These steps are the same regardless of whether you deployed locally, on Railway,
Render, or Oracle Cloud.

### 6.1 Create a savings product

Before customers can open accounts, at least one product must exist.

```bash
# Replace YOUR_URL with your actual API base URL
# Replace YOUR_TOKEN with the accessToken from login (see Section 7)
curl -s -X POST $YOUR_URL/api/v1/admin/products \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Regular Savings",
    "code": "SAV001",
    "productType": "SAVINGS",
    "interestRate": "0.04",
    "minimumBalance": "500",
    "isActive": true
  }' | jq '{id, name, code}'
```

Note the returned `id` as `PRODUCT_ID`.

### 6.2 Create a loan product

```bash
curl -s -X POST $YOUR_URL/api/v1/admin/products \
  -H "Authorization: Bearer $YOUR_TOKEN" \
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
  }' | jq '{id, name}'
```

### 6.3 Configure maker-checker (optional)

Set up approval thresholds — for example, require a second approver for cash withdrawals
above ₦500,000:

```bash
curl -s -X POST $YOUR_URL/api/v1/admin/maker-checker-rules \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "TRANSACTIONS",
    "action": "OTC_WITHDRAWAL",
    "requiresApprovalAbove": "500000",
    "channels": ["OTC"],
    "ttlMinutes": 60
  }'
```

---

## 7. Testing the API

### 7.1 Login and get a token

This is the starting point for every test session.

```bash
export BASE="http://localhost:3000/api/v1"   # change to your online URL if needed

curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ftb.ng",
    "password": "Admin@1234",
    "tenantCode": "FTB001"
  }' | jq .
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

The access token expires after 15 minutes. When it does, use the refresh token:

```bash
curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" | jq .accessToken
```

---

### 7.2 Core banking flow (step by step)

**Step 1 — Create a customer**

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
echo "Customer: $CUSTOMER_ID"
```

**Step 2 — Open a savings account**

```bash
export ACCOUNT_ID=$(curl -s -X POST $BASE/accounts/savings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\": \"$CUSTOMER_ID\", \"productId\": \"$PRODUCT_ID\"}" \
  | jq -r .id)
echo "Account: $ACCOUNT_ID"
```

**Step 3 — Deposit ₦100,000**

```bash
curl -s -X POST $BASE/transactions/deposit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: dep-001" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\": \"$ACCOUNT_ID\", \"amount\": \"100000\", \"narration\": \"Opening deposit\"}" \
  | jq '{id, reference, status}'
```

> **Idempotency-Key:** Every financial endpoint requires this header. If the same request
> is sent twice with the same key, the second one returns the original response without
> processing again. This prevents double-charges. Use a unique value per transaction —
> a UUID is ideal.

**Step 4 — Check balance**

```bash
curl -s $BASE/accounts/$ACCOUNT_ID/balance \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected:
```json
{
  "accountNumber": "0000010001",
  "currentBalance": "100000.0000",
  "availableBalance": "100000.0000"
}
```

**Step 5 — Withdraw ₦20,000**

```bash
curl -s -X POST $BASE/transactions/withdraw \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: wdr-001" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\": \"$ACCOUNT_ID\", \"amount\": \"20000\", \"narration\": \"Cash withdrawal\"}" \
  | jq .
```

**Step 6 — Get account statement**

```bash
curl -s "$BASE/reports/statement?accountNumber=0000010001&from=2025-01-01&to=2025-12-31" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

### 7.3 Testing via Swagger UI

Swagger is a browser-based interface where you can explore and call every API endpoint.
It is available at `/api/docs` in `development` mode.

1. Open `http://localhost:3000/api/docs` (or your online URL equivalent, if NODE_ENV=development)
2. Click **Authorize** (top right corner — the lock icon)
3. Log in first via `POST /api/v1/auth/login` in Swagger to get a token
4. Paste the `accessToken` value into the Authorize dialog
5. Every subsequent request in Swagger will include your Bearer token automatically

---

### 7.4 Testing via Postman

1. Open Postman → **Import** → **Link** → paste:
   `http://localhost:3000/api/docs-json`
   This imports the full OpenAPI spec as a Postman collection automatically.

2. Create a Postman environment with:
   - `base_url`: `http://localhost:3000/api/v1`
   - `token`: *(empty for now)*

3. Run the Login request, then in the **Tests** tab add:
   ```javascript
   pm.environment.set("token", pm.response.json().accessToken);
   ```

4. All other requests should use `Authorization: Bearer {{token}}`.

---

## 8. Environment Variables Reference

Full reference of every variable the application reads, with explanations.

| Variable | Required | Default | Explanation |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string. Format: `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | Yes | — | Signs access tokens. Must be at least 32 characters. Changing this invalidates all existing sessions. |
| `JWT_REFRESH_SECRET` | Yes | — | Signs refresh tokens. Must differ from JWT_SECRET. |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime. Format: `15m`, `1h`, `7d` |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `PORT` | No | `3000` | HTTP port the server listens on. Render requires `10000`. |
| `NODE_ENV` | No | `development` | Set to `production` in cloud environments. Disables Swagger in production. |
| `RABBITMQ_URL` | No | — | AMQP connection string. App starts without it but the notification consumer throws on startup. |
| `MINIO_ENDPOINT` | No | — | MinIO/S3 host. Without this, document upload endpoints will fail. |
| `MINIO_PORT` | No | `9000` | MinIO port (not needed for AWS S3) |
| `MINIO_USE_SSL` | No | `false` | Set `true` for AWS S3 or any HTTPS MinIO |
| `MINIO_ACCESS_KEY` | No | — | MinIO/S3 access key |
| `MINIO_SECRET_KEY` | No | — | MinIO/S3 secret key |
| `MINIO_BUCKET` | No | `core-banking` | Bucket name for all file uploads |
| `NIBSS_SANDBOX` | No | `true` | `true` = log NIP/BVN payloads, no real calls |
| `NIBSS_BASE_URL` | No | — | NIBSS API base URL (production only) |
| `TERMII_SANDBOX` | No | `true` | `true` = log SMS payloads, no real sends |
| `TERMII_API_KEY` | No | — | Termii API key (production only) |
| `TERMII_SENDER_ID` | No | — | Registered SMS sender ID (production only) |
| `SENDGRID_SANDBOX` | No | `true` | `true` = log email payloads, no real sends |
| `SENDGRID_API_KEY` | No | — | SendGrid API key (production only) |
| `SENDGRID_FROM_EMAIL` | No | — | Verified sender email (production only) |
| `CREDIT_BUREAU_SANDBOX` | No | `true` | `true` = return mock credit report |
| `CREDIT_BUREAU_API_KEY` | No | — | CRC API key (production only) |
| `AML_WEBHOOK_SECRET` | No | — | HMAC-SHA256 secret for verifying AML vendor callbacks |
| `PUPPETEER_EXECUTABLE_PATH` | No | — | Path to Chromium binary for PDF generation. Set to `/usr/bin/chromium-browser` on Linux |
| `CORS_ORIGINS` | No | `*` | Comma-separated list of allowed CORS origins, e.g. `https://app.yourbank.ng` |

---

## 9. Troubleshooting

### Application errors

| Error | Cause | Fix |
|-------|-------|-----|
| `JWT_SECRET must be at least 32 characters` | Placeholder value in `.env` | Generate a proper secret — see Section 2.4 |
| `relation "Account" does not exist` | Schema not applied | Run `npx prisma db push` |
| `Cannot find module '@prisma/client'` | Prisma client not generated | Run `npm install && npx prisma generate` |
| `P1001: Can't reach database server` | Postgres not running | `docker-compose up -d postgres` |
| `ECONNREFUSED 127.0.0.1:5672` | RabbitMQ not running | `docker-compose up -d rabbitmq` |
| `Journal does not balance` | Bug in a service's GL entries | All debit amounts must exactly equal credit amounts. Check the posting entries in the relevant service method. |
| `GL account 'X' is not a DETAIL-level account` | Posting to a header/category GL account | Only DETAIL-level GL accounts accept postings. Check your GL chart with `GET /api/v1/gl` |

### Docker errors

| Error | Cause | Fix |
|-------|-------|-----|
| `port is already allocated` | Another process is using the port | `sudo lsof -i :5432` then kill the process, or change the port in `docker-compose.yml` |
| `permission denied while trying to connect to the Docker daemon` | User not in docker group | `sudo usermod -aG docker $USER` then log out and back in |
| `no space left on device` | Docker images filling disk | `docker system prune -a` (removes unused images/containers) |

### Railway/Render errors

| Error | Cause | Fix |
|-------|-------|-----|
| Deploy fails with `ENOENT: no such file or directory, open 'dist/main.js'` | Build command didn't run or failed | Check build logs. Make sure Build Command is `npm install && npm run build` |
| App starts but returns 502 | Wrong `PORT` environment variable | Railway auto-detects 3000. Render needs `PORT=10000` |
| `SEED_TENANT_ID env var required` | Ran seed script directly | Use `onboard-tenant.ts` instead, not the individual seed scripts |
| `P2002: Unique constraint failed` on onboard | Tenant already exists | Use a different `--tenantCode` or reset the database |

### Token errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` on every request | Token expired or not included | Re-login to get a new `accessToken`. Check that `Authorization: Bearer <token>` is set correctly |
| `403 Forbidden` on a specific endpoint | User lacks the required permission | Assign the required permission to the user's role via `PATCH /api/v1/auth/roles/:roleId/permissions` |
