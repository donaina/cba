import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class SendNotificationDto {
  @IsString()
  tenantId: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsString()
  templateKey: string;

  @IsString()
  recipient: string;

  @IsOptional()
  @IsObject()
  variables: Record<string, string> = {};
}
