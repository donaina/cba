import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async publish(dto: SendNotificationDto): Promise<void> {
    await this.amqpConnection.publish('cba.transactions', 'notification.send', dto);
  }

  async listLogs(
    customerId?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: object[]; total: number; page: number; limit: number }> {
    const tenantId = this.ctx.tenantId;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(customerId ? { customerId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
