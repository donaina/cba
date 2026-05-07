import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SendgridService {
  private readonly logger = new Logger(SendgridService.name);

  constructor(private readonly httpService: HttpService) {}

  async send(
    recipient: string,
    subject: string,
    content: string,
    tenantId: string,
  ): Promise<{ success: boolean; providerRef?: string }> {
    if (process.env.SENDGRID_SANDBOX === 'true') {
      console.log({ to: recipient, subject, content });
      return { success: true, providerRef: 'SANDBOX' };
    }

    await firstValueFrom(
      this.httpService.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: [{ email: recipient }], subject }],
          from: { email: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@example.com' },
          content: [{ type: 'text/html', value: content }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    return { success: true };
  }
}
