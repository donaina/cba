import { IsString, IsArray, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({ example: 'Production Webhook', description: 'Human-readable label for this endpoint' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://api.example.com/webhooks/cba', description: 'HTTPS endpoint that will receive HMAC-SHA256 signed events' })
  @IsUrl()
  url: string;

  @ApiProperty({ example: ['transaction.completed', 'loan.disbursed'], description: 'List of event types to subscribe to', type: [String] })
  @IsArray()
  @IsString({ each: true })
  events: string[];
}
