/**
 * Auth utilities — login, logout, token helpers.
 *
 * Verified against the actual backend (auth.service.ts):
 *
 * POST /auth/login
 *   Body:     { email, password, tenantCode? }   ← tenantCode, NOT tenantId
 *   Response: { accessToken, refreshToken }       ← tokens only, NO user object
 *
 * POST /auth/refresh
 *   Body:     { refreshToken }
 *   Response: { accessToken, refreshToken }       ← refresh token is rotated each time
 *
 * POST /auth/logout  (requires Bearer token)
 *   Response: 204 No Content
 *
 * The JWT payload (decoded from accessToken) contains:
 *   { sub, tenantId, branchId, sessionId, permissions }
 *
 * Since there is no /auth/me endpoint, user identity is built from:
 *   - JWT claims  → userId, tenantId, branchId, sessionId, permissions
 *   - Login email → stored separately in a cookie for display
 */

import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { apiClient } from './api-client';

// ── Types ────────────────────────────────────────────────────────────────────

/** Shape of the JWT payload issued by the backend */
export interface JwtPayload {
  sub: string;          // userId
  tenantId: string;
  branchId: string;
  sessionId: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface LoginPayload {
  email: string;
  password: string;
  tenantCode?: string;  // optional — if omitted, email must be unique across tenants
}

/** Derived user object built from JWT + stored email */
export interface AuthUser {
  id: string;           // JWT sub
  email: string;        // stored from login form
  tenantId: string;
  branchId: string;
  sessionId: string;
  permissions: string[];
}

// ── Cookie config ─────────────────────────────────────────────────────────────

const COOKIE_OPTS: Cookies.CookieAttributes = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
};

// ── Auth functions ────────────────────────────────────────────────────────────

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const { data } = await apiClient.post<{ accessToken: string; refreshToken: string }>(
    '/auth/login',
    payload,
  );

  // Decode JWT to extract user claims
  const claims = jwtDecode<JwtPayload>(data.accessToken);

  // Persist tokens
  Cookies.set('access_token', data.accessToken, { ...COOKIE_OPTS, expires: 1 });
  Cookies.set('refresh_token', data.refreshToken, { ...COOKIE_OPTS, expires: 7 });

  // Persist derived user info (JWT has no name/email — store email from form)
  const user: AuthUser = {
    id: claims.sub,
    email: payload.email,
    tenantId: claims.tenantId,
    branchId: claims.branchId,
    sessionId: claims.sessionId,
    permissions: claims.permissions,
  };
  Cookies.set('auth_user', JSON.stringify(user), { ...COOKIE_OPTS, expires: 1 });
  Cookies.set('tenant_id', claims.tenantId, COOKIE_OPTS);

  return user;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    Cookies.remove('tenant_id');
    Cookies.remove('auth_user');
  }
}

/**
 * Rehydrate user from the auth_user cookie (set at login).
 * No API call needed — JWT claims are already stored.
 */
export function getUserFromCookie(): AuthUser | null {
  try {
    const raw = Cookies.get('auth_user');
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | undefined {
  return Cookies.get('access_token');
}

export function getTenantId(): string | undefined {
  return Cookies.get('tenant_id');
}

export function isAuthenticated(): boolean {
  return Boolean(Cookies.get('access_token'));
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return user?.permissions?.includes(permission) ?? false;
}

export function hasRole(user: AuthUser | null, ...roles: string[]): boolean {
  // Roles are resolved as permissions in this backend — check permissions instead
  return roles.some((role) => user?.permissions?.includes(role));
}

/**
 * Returns the home dashboard route for a given user.
 * SUPER_ADMIN (identified by admin:config permission) → /admin/dashboard
 * Everyone else → /ops/dashboard
 */
export function getDefaultRoute(user: AuthUser | null): string {
  return hasPermission(user, 'admin:config') ? '/admin/dashboard' : '/ops/dashboard';
}
