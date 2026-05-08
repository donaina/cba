import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FreezeAccountDto {
  @ApiPropertyOptional({ description: 'Account UUID (can also be passed via URL param)' })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiProperty({ example: 'PEP match — pending review', description: 'Reason for the compliance freeze' })
  @IsString()
  note: string;
}
