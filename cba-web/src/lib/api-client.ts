/**
 * Typed API client for the NestJS CBA backend.
 *
 * Base URL: NEXT_PUBLIC_API_BASE_URL (must include /api/v1)
 * Example:  http://localhost:3000/api/v1
 *
 * All requests automatically:
 *   - Attach Bearer token from the access_token cookie
 *   - Retry once on 401 using the refresh token → POST /auth/refresh
 *   - Throw a structured ApiError on non-2xx responses
 */

import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ── Request interceptor: attach auth token ─────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: refresh on 401, map errors ──────────────────────
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ message: string; code?: string }>) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
            resolve(apiClient(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshToken = Cookies.get('refresh_token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = data;

        Cookies.set('access_token', accessToken, { secure: true, sameSite: 'strict', expires: 1 });
        // Refresh token is rotated on every refresh — update the stored value
        Cookies.set('refresh_token', newRefreshToken, { secure: true, sameSite: 'strict', expires: 7 });
        pendingRequests.forEach((cb) => cb(accessToken));
        pendingRequests = [];

        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
        return apiClient(original);
      } catch {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        Cookies.remove('tenant_id');
        Cookies.remove('auth_user');
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }

    const { status, data } = error.response ?? {};
    throw new ApiError(
      status ?? 0,
      data?.code ?? 'UNKNOWN_ERROR',
      data?.message ?? error.message,
    );
  },
);
