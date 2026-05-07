import { Module } from '@nestjs/common';
import { TenantContextModule } from './tenant/tenant-context.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { IdempotencyMiddleware } from './middleware/idempotency.middleware';

@Module({
  imports: [TenantContextModule],
  providers: [TenantMiddleware, AuditLogInterceptor, IdempotencyMiddleware],
  exports: [TenantContextModule, TenantMiddleware, AuditLogInterceptor, IdempotencyMiddleware],
})
export class CommonModule {}
