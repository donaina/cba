import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { TenantContextModule } from '@libs/common';
import { AmlService } from './aml.service';
import { AmlPublisher } from './aml.publisher';
import { AmlController } from './aml.controller';
import { AmlWebhookController } from './aml-webhook.controller';

@Module({
  imports: [RabbitMQModule, TenantContextModule],
  controllers: [AmlController, AmlWebhookController],
  providers: [AmlService, AmlPublisher],
  exports: [AmlService],
})
export class AmlModule {}
