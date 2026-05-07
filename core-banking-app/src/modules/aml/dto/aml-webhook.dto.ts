import { IsString, IsObject, IsNumber } from 'class-validator';

export class AmlWebhookDto {
  @IsString()
  action: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsNumber()
  timestamp: number;
}
