import { Module } from '@nestjs/common';
import { TenantContextModule } from '@libs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [TenantContextModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
