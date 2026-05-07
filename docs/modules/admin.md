# Admin Module

**Path**: `modules/admin/`

---

## Responsibilities

- Product management (savings, current, FD, loan products + rate bands)
- Transaction type configuration (fees, VAT, WHT, maker-checker thresholds)
- Tax rate management (VAT, WHT — effective-dated, per tenant)
- Working calendar (holidays, value date computation)
- Maker-checker rule configuration
- Bank branding (logo upload/management)

---

## Endpoints

### Products

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/admin/products` | `admin:config` | Create product |
| PATCH | `/admin/products/:id` | `admin:config` | Update product |
| GET | `/admin/products` | `admin:read` | List products |
| POST | `/admin/products/:id/rate-bands` | `admin:config` | Add rate band |

### Transaction types

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/admin/transaction-types` | `admin:config` | Create transaction type |
| PATCH | `/admin/transaction-types/:id` | `admin:config` | Update |
| DELETE | `/admin/transaction-types/:id` | `admin:config` | Delete (blocked if in use) |

### Tax rates

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/admin/tax-rates` | `admin:config` | Set new tax rate (expires current) |
| GET | `/admin/tax-rates/active` | `admin:read` | Get active rates |

### Maker-checker rules

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/admin/maker-checker-rules` | `admin:config` | Create/update rule |

### Branding / Logo

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| PATCH | `/admin/branding/logo` | `admin:config` | Upload/replace tenant logo |
| GET | `/admin/branding/logo` | `admin:read` | Get logo presigned URL |
| DELETE | `/admin/branding/logo` | `admin:config` | Remove logo |

---

## Logo behaviour

- Accepted formats: PNG, JPEG, SVG, WebP
- Maximum size: 2 MB
- Stored in MinIO: `branding/{tenantId}/logo-{uuid}.{ext}`
- Resized to max 400×200px (aspect ratio preserved) for non-SVG files using `sharp`
- Old logo deleted from MinIO when replaced
- Embedded as base64 data URI in all PDF outputs (never as a URL — Puppeteer limitation)

---

## Value date computation

`AdminService.computeValueDate(date, tenantId)` skips weekends and entries in
`WorkingCalendar` marked `isHoliday = true` for the tenant.
Used by transaction service to set settlement dates for NIP transfers.

---

## Tax rate effective dating

```typescript
// setTaxRate() always:
// 1. Expires the current active config (sets expiryDate = today)
// 2. Creates new config with effectiveDate = today
// This ensures historical rates are preserved for audit
```
