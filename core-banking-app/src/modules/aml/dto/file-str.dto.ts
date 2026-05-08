import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileStrDto {
  @ApiProperty({ description: 'Customer UUID associated with the suspicious activity' })
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Array of transaction UUIDs supporting the STR', type: [String] })
  @IsArray()
  transactionIds: string[];

  @ApiProperty({ example: 'Multiple large cash deposits with no apparent business purpose', description: 'STR narrative' })
  @IsString()
  narrative: string;

  @ApiPropertyOptional({ description: 'Linked AML alert UUID (if triggered by an alert)' })
  @IsOptional()
  @IsString()
  alertId?: string;
}
