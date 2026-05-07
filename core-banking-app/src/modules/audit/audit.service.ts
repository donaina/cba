import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async queryLogs(dto: AuditLogQueryDto): Promise<{
    data: object[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.ctx.tenantId;
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenantId,
      ...(dto.userId ? { userId: dto.userId } : {}),
      ...(dto.path ? { path: { contains: dto.path } } : {}),
      ...(dto.from || dto.to
        ? {
            createdAt: {
              ...(dto.from ? { gte: new Date(dto.from) } : {}),
              ...(dto.to ? { lte: new Date(dto.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
