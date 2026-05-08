import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { NotificationChannel } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({ description: 'Tenant UUID' })
  @IsString()
  tenantId: string;

  @ApiPropertyOptional({ description: 'Customer UUID (used for in-app notifications)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ enum: NotificationChannel, description: 'Delivery channel (SMS | EMAIL | IN_APP)' })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ example: 'TRANSACTION_ALERT', description: 'Notification template key' })
  @IsString()
  templateKey: string;

  @ApiProperty({ example: '+2348012345678', description: 'Phone number (SMS) or email address (EMAIL)' })
  @IsString()
  recipient: string;

  @ApiPropertyOptional({ example: { amount: '5000', accountNumber: '0123456789' }, description: 'Template variable substitutions' })
  @IsOptional()
  @IsObject()
  variables: Record<string, string> = {};
}
