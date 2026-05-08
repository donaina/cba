import { IsString, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AmlWebhookDto {
  @ApiProperty({ example: 'FREEZE_ACCOUNT', description: 'AML action (FREEZE_ACCOUNT | FILE_STR | PEP_MATCH)' })
  @IsString()
  action: string;

  @ApiProperty({ description: 'Action-specific payload object' })
  @IsObject()
  data: Record<string, unknown>;

  @ApiProperty({ example: 1700000000000, description: 'Unix timestamp in ms (used for replay protection)' })
  @IsNumber()
  timestamp: number;
}
