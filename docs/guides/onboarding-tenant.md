# Onboarding a New Tenant

A "tenant" is one bank or financial institution. Each tenant gets completely isolated data.

## What onboarding creates

1. `Organisation` row (the bank entity)
2. `Branch` row (Head Office)
3. GL chart of accounts (full CBN COA)
4. Default transaction types
5. All permission codes
6. `SUPER_ADMIN` role with all permissions
7. Initial admin user (must change password on first login)

---

## Method 1 — Automated script (recommended)

```bash
export SEED_TENANT_ID=$(node -e "console.log(require('crypto').randomUUID())")
npm run onboard-tenant
```

Prints admin credentials on completion. Store them securely.

---

## Method 2 — API walkthrough

### 1. Create the organisation

```http
POST /api/v1/admin/organisations
Content-Type: application/json

{
  "name": "Sunrise Microfinance Bank",
  "shortName": "SunriseMFB",
  "tenantCode": "SUNMFB",
  "currencyCode": "NGN",
  "countryCode": "NG",
  "address": "123 Marina Street, Lagos",
  "rcNumber": "RC1234567",
  "cbLicenceNumber": "MFB/CBN/2024/001",
  "sortCode": "090123"
}
```

### 2. Create Head Office branch

```http
POST /api/v1/admin/branches
{
  "name": "Head Office",
  "code": "HO",
  "branchType": "HEAD_OFFICE",
  "address": "123 Marina Street, Lagos"
}
```

### 3. Seed GL and transaction types

```bash
SEED_TENANT_ID={tenantId} npm run seed
```

### 4. Create the first admin user

```http
POST /api/v1/auth/users
{
  "email": "admin@sunrisemfb.ng",
  "firstName": "System",
  "lastName": "Admin",
  "roleIds": ["{superAdminRoleId}"],
  "branchIds": ["ALL_BRANCHES"]
}
```

---

## Setting up products

### Savings product

```http
POST /api/v1/admin/products
{
  "name": "Regular Savings",
  "code": "SAV001",
  "productType": "SAVINGS",
  "minBalance": "0",
  "maxBalance": "9999999999",
  "interestRate": "0.04",
  "rateBands": [
    { "minAmount": "0",        "maxAmount": "499999",    "rate": "0.03" },
    { "minAmount": "500000",   "maxAmount": "9999999",   "rate": "0.04" },
    { "minAmount": "10000000", "maxAmount": "9999999999","rate": "0.045" }
  ],
  "isActive": true
}
```

### Loan product

```http
POST /api/v1/admin/products
{
  "name": "Business Term Loan",
  "code": "LOAN001",
  "productType": "LOAN",
  "minBalance": "10000",
  "maxBalance": "5000000",
  "interestRate": "0.24",
  "minTenorDays": 30,
  "maxTenorDays": 365,
  "isActive": true
}
```

---

## Configuring maker-checker rules

```http
POST /api/v1/admin/maker-checker-rules
{
  "module": "TRANSACTIONS",
  "action": "CASH_WITHDRAWAL",
  "requiresApprovalAbove": 500000,
  "channels": ["OTC"],
  "requiredApprovers": 1,
  "ttlMinutes": 60
}
```

---

## Uploading the bank logo

```http
PATCH /api/v1/admin/branding/logo
Content-Type: multipart/form-data

logo: <file>   (PNG, JPEG, SVG, or WebP — max 2 MB)
```

The logo automatically appears in:
- Account statement PDFs (top-left header)
- Fixed deposit certificate PDFs (top-left header)

Verify upload:
```http
GET /api/v1/admin/branding/logo
→ { "logoUrl": "https://..." }
```

---

## Tenant isolation verification

```bash
npm run test:e2e -- --testPathPattern=tenant-isolation
```

---

## Offboarding / deactivation

```http
PATCH /api/v1/admin/organisations/{tenantId}/deactivate
```

Sets `Organisation.isActive = false`. All logins for this tenant's users return `403`.
Data is retained. Hard deletion requires manual DBA intervention.
