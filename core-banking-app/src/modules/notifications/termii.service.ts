import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name);

  constructor(private readonly httpService: HttpService) {}

  async send(
    recipient: string,
    content: string,
    tenantId: string,
  ): Promise<{ success: boolean; providerRef?: string }> {
    if (process.env.TERMII_SANDBOX === 'true') {
      console.log({ to: recipient, content, tenantId });
      return { success: true, providerRef: 'SANDBOX' };
    }

    const response = await firstValueFrom(
      this.httpService.post('https://api.ng.termii.com/api/sms/send', {
        api_key: process.env.TERMII_API_KEY,
        to: recipient,
        from: process.env.TERMII_SENDER_ID,
        sms: content,
        type: 'plain',
        channel: 'dnd',
      }),
    );

    return { success: true, providerRef: response.data.message_id };
  }
}
