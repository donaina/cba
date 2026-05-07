import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { TermiiService } from './termii.service';
import { SendgridService } from './sendgrid.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationConsumer {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly termii: TermiiService,
    private readonly sendgrid: SendgridService,
  ) {}

  @RabbitSubscribe({
    exchange: 'cba.transactions',
    routingKey: 'notification.send',
    queue: 'cba.notifications',
    queueOptions: { deadLetterExchange: 'cba.dlx' },
  })
  async handleNotification(dto: SendNotificationDto): Promise<void> {
    // 1. Find template (non-fatal if missing — fall back to raw key)
    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        tenantId: dto.tenantId,
        key: dto.templateKey,
        channel: dto.channel as NotificationChannel,
        isActive: true,
      },
    });
    const content = template
      ? this.renderTemplate(template.body, dto.variables)
      : dto.templateKey;
    const subject = template?.subject
      ? this.renderTemplate(template.subject, dto.variables)
      : dto.templateKey;

    // 2. Send — let provider errors propagate so the message is nacked → DLQ
    let result: { success: boolean; providerRef?: string };
    try {
      if (dto.channel === 'SMS') {
        result = await this.termii.send(dto.recipient, content, dto.tenantId);
      } else if (dto.channel === 'EMAIL') {
        result = await this.sendgrid.send(dto.recipient, subject, content, dto.tenantId);
      } else {
        result = { success: true, providerRef: 'IN_APP' };
      }
    } catch (err) {
      this.logger.error(`Provider send failed, nacking for DLQ: ${err}`);
      throw err; // nack → message goes to cba.dlx
    }

    // 3. Log (best-effort — don't nack just because DB log failed after a successful send)
    try {
      await this.prisma.notificationLog.create({
        data: {
          tenantId: dto.tenantId,
          customerId: dto.customerId,
          channel: dto.channel as NotificationChannel,
          templateKey: dto.templateKey,
          recipient: dto.recipient,
          content,
          status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          providerRef: result.providerRef,
          sentAt: result.success ? new Date() : undefined,
        },
      });
    } catch (logErr) {
      this.logger.error(`Failed to write notification log: ${logErr}`);
    }
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
  }
}
