import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '@libs/common';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @RequirePermission('audit:read')
  getLogs(@Query() query: AuditLogQueryDto) {
    return this.auditService.queryLogs(query);
  }
}
