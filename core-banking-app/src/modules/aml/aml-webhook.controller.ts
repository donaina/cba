import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { createHmac } from 'crypto';
import { Public } from '@libs/common';
import { AmlService } from './aml.service';
import { AmlWebhookDto } from './dto/aml-webhook.dto';
import { AmlAlertType, AmlAlertSeverity } from '@prisma/client';

@Controller('webhooks/aml')
export class AmlWebhookController {
  private readonly logger = new Logger(AmlWebhookController.name);

  constructor(private readonly amlService: AmlService) {}

  @Post('callback')
  @Public()
  async handleCallback(
    @Body() body: AmlWebhookDto,
    @Req() req: Request,
  ) {
    const signature = req.headers['x-aml-signature'] as string;
    const timestamp = req.headers['x-aml-timestamp'] as string;

    if (!signature || !timestamp) {
      throw new UnauthorizedException('Missing AML signature headers');
    }

    // Replay protection: |now - timestamp| < 5 minutes
    if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) {
      throw new UnauthorizedException('Timestamp expired');
    }

    const expected = createHmac('sha256', process.env.AML_WEBHOOK_SECRET ?? '')
      .update(JSON.stringify(body) + timestamp)
      .digest('hex');

    if (signature !== expected) {
      throw new UnauthorizedException('Invalid signature');
    }

    this.logger.log(`AML webhook received: action=${body.action}`);

    switch (body.action) {
      case 'FREEZE_ACCOUNT': {
        const data = body.data as { accountId: string; note: string };
        await this.amlService.freezeAccount({ accountId: data.accountId, note: data.note });
        break;
      }
      case 'FILE_STR': {
        const data = body.data as {
          customerId: string;
          transactionIds: string[];
          narrative: string;
          alertId?: string;
        };
        await this.amlService.fileStr({
          customerId: data.customerId,
          transactionIds: data.transactionIds,
          narrative: data.narrative,
          alertId: data.alertId,
        });
        break;
      }
      case 'PEP_MATCH': {
        const data = body.data as {
          customerId: string;
          description?: string;
          metadata?: Record<string, unknown>;
        };
        await this.amlService.createAlert(
          data.customerId,
          AmlAlertType.PEP_MATCH,
          AmlAlertSeverity.HIGH,
          data.description ?? 'PEP match detected by external AML provider',
          data.metadata,
        );
        break;
      }
      default:
        this.logger.warn(`Unknown AML webhook action: ${body.action}`);
    }

    return { received: true };
  }
}
