import { Module } from '@nestjs/common';
import { TenantContextModule } from '@libs/common';
import { AmlService } from './aml.service';
import { AmlPublisher } from './aml.publisher';
import { AmlController } from './aml.controller';
import { AmlWebhookController } from './aml-webhook.controller';

@Module({
  imports: [TenantContextModule],
  controllers: [AmlController, AmlWebhookController],
  providers: [AmlService, AmlPublisher],
  exports: [AmlService],
})
export class AmlModule {}
