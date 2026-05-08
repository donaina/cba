import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenSavingsDto {
  @ApiProperty({ description: 'UUID of the customer' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'UUID of the savings product' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'UUID of the branch (defaults to head office)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
