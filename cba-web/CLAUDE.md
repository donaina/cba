# NexCore — Frontend (cba-web)

## Backend API facts (verified from /api/docs-json)

- Base URL: `http://localhost:3000/api/v1` — all endpoints include this prefix
- Swagger UI: `http://localhost:3000/api/docs`
- Swagger JSON: `http://localhost:3000/api/docs-json`

### Confirmed auth endpoints (verified from auth.service.ts + auth.controller.ts)
- `POST /auth/login`   → body `{ email, password, tenantCode? }` → returns `{ accessToken, refreshToken }` ONLY — no user object
- `POST /auth/logout`  → 204 No Content (requires Bearer token)
- `POST /auth/refresh` → body `{ refreshToken }` → returns `{ accessToken, refreshToken }` (token is ROTATED every call)
- `POST /auth/users`   → create staff user (requires `user:create` permission)
- `POST /auth/roles`   → create role (requires `role:create` permission)
- ⚠️ There is NO `/auth/me` endpoint.
- ⚠️ Login uses `tenantCode` (e.g. "NB001"), NOT `tenantId` (UUID).
- ⚠️ Login returns tokens only. User info (userId, tenantId, permissions) is decoded from the JWT using `jwt-decode`.
- ⚠️ JWT payload shape: `{ sub (userId), tenantId, branchId, sessionId, permissions[], iat, exp }`
- Email is NOT in the JWT — it is stored separately in the `auth_user` cookie from the login form input.

### Full verified route list
```
/api/v1/accounts/current          /api/v1/accounts/savings
/api/v1/accounts/fixed-deposit    /api/v1/accounts/{id}/balance
/api/v1/admin/branches            /api/v1/admin/branding/logo
/api/v1/admin/maker-checker-rules /api/v1/admin/products
/api/v1/admin/tax-rates           /api/v1/admin/transaction-types
/api/v1/audit/logs
/api/v1/auth/login                /api/v1/auth/logout
/api/v1/auth/refresh              /api/v1/auth/roles
/api/v1/auth/users
/api/v1/baas/api-keys             /api/v1/baas/webhooks
/api/v1/compliance/alerts         /api/v1/compliance/freeze/{accountId}
/api/v1/compliance/str            /api/v1/compliance/unfreeze/{accountId}
/api/v1/customers                 /api/v1/customers/{id}
/api/v1/documents/upload          /api/v1/documents/{id}
/api/v1/gl/accounts
/api/v1/kyc/bvn/verify            /api/v1/kyc/credit-report
/api/v1/loans                     /api/v1/loans/apply
/api/v1/nibss/name-enquiry        /api/v1/nibss/inward-credit
/api/v1/notifications/logs        /api/v1/notifications/send
/api/v1/reports/statement         /api/v1/reports/trial-balance
/api/v1/reports/loan-portfolio    /api/v1/reports/statement/pdf
/api/v1/transactions/deposit      /api/v1/transactions/withdraw
/api/v1/transactions/transfer     /api/v1/transactions/nip-transfer
/api/v1/transactions/approve      /api/v1/transactions/pending-approvals
/api/v1/webhooks/aml/callback
```

---

## Non-negotiable rules

1. **Money**: Always use `formatNaira()` from `src/lib/utils.ts`. Never `Number().toFixed()` for currency.
2. **Auth cookies**: Access token → `access_token`, refresh → `refresh_token`, user → `auth_user` (JSON). Never localStorage.
3. **API calls**: Always go through `apiClient` from `src/lib/api-client.ts`. Never raw `fetch` or bare `axios`.
4. **No `/auth/me`**: User is rehydrated from the `auth_user` cookie via `getUserFromCookie()`. Do not add an API call for this.
5. **Forms**: React Hook Form + Zod resolver on every form. No uncontrolled inputs outside RHF.
6. **Errors**: Catch `ApiError` and show via `toast.error()` from `sonner`.
7. **Types**: Run `npm run gen:types` when backend API changes.
8. **Permissions**: Use `hasPermission()` and `hasRole()` from `useAuth()`. Never hard-code role strings outside the auth provider.
9. **No `any`**: TypeScript strict mode is on.
10. **Server vs client**: Default to Server Components. Add `'use client'` only for hooks, browser APIs, or event handlers.
11. **Idempotency**: Financial endpoints (deposit, withdraw, transfer, nip-transfer, repay) must send an `Idempotency-Key` header (uuid v4).

---

## Stack

- Next.js 14 App Router + TypeScript strict
- Tailwind CSS + CSS variables (globals.css)
- shadcn/ui via `@radix-ui/*`
- TanStack Query for server state
- TanStack Table for data grids
- React Hook Form + Zod for forms
- Zustand for branch/tenant global state
- Axios with auto token-refresh interceptor

## Project structure

```
src/
├── app/
│   ├── (auth)/login/        # Public login page
│   ├── (ops)/               # Banking ops portal — uses ops sidebar
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── accounts/
│   │   ├── loans/
│   │   ├── transactions/
│   │   ├── reports/
│   │   ├── kyc/
│   │   ├── compliance/      # /api/v1/compliance/* (NOT /aml/)
│   │   ├── documents/
│   │   ├── notifications/
│   │   └── audit/
│   └── (admin)/             # Platform admin portal — uses admin sidebar
│       ├── dashboard/
│       ├── branches/
│       ├── gl/
│       ├── products/
│       ├── tax-rates/
│       ├── txn-types/
│       ├── maker-checker/
│       ├── api-keys/
│       ├── webhooks/
│       └── branding/
├── components/layout/       # Sidebar, Header
├── hooks/                   # Re-exports from providers
├── lib/
│   ├── api-client.ts        # Axios + auto refresh interceptor
│   ├── auth.ts              # login/logout/cookie helpers (NO /auth/me)
│   └── utils.ts             # formatNaira, formatDate, cn()
├── providers/               # AuthProvider, TenantProvider, QueryProvider
├── types/api.d.ts           # Auto-generated (npm run gen:types)
└── middleware.ts            # Cookie-based route protection
```

## Adding shadcn/ui components

```bash
npx shadcn@latest add button table dialog badge input label select tabs
```

## Common patterns

### Fetch with TanStack Query
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['customers', page],
  queryFn: () => apiClient.get('/customers', { params: { page } }).then(r => r.data),
});
```

### Mutation
```tsx
const mutation = useMutation({
  mutationFn: (dto) => apiClient.post('/customers', dto).then(r => r.data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    toast.success('Customer created');
  },
  onError: (err: ApiError) => toast.error(err.message),
});
```

### Financial transaction with idempotency key
```ts
import { v4 as uuidv4 } from 'uuid';
await apiClient.post('/transactions/deposit', dto, {
  headers: { 'Idempotency-Key': uuidv4() },
});
```
