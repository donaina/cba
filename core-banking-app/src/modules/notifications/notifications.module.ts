import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { HttpModule } from '@nestjs/axios';
import { TenantContextModule } from '@libs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationConsumer } from './notification.consumer';
import { TermiiService } from './termii.service';
import { SendgridService } from './sendgrid.service';

@Module({
  imports: [
    RabbitMQModule,
    HttpModule,
    TenantContextModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationConsumer,
    TermiiService,
    SendgridService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
