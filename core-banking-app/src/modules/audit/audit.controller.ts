import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermission } from '@libs/common';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @ApiOperation({ summary: 'Query audit logs (sensitive fields are redacted)' })
  @Get('logs')
  @RequirePermission('audit:read')
  getLogs(@Query() query: AuditLogQueryDto) {
    return this.auditService.queryLogs(query);
  }
}
