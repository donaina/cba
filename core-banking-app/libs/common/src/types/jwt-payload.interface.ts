export interface JwtPayload {
  sub: string;
  tenantId: string;
  branchId: string;
  sessionId: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}
