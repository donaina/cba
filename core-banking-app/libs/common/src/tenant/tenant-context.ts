import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  tenantId: string;
  userId: string;
  branchId: string;
  sessionId: string;
}
