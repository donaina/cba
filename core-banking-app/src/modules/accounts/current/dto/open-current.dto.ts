import { IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenCurrentDto {
  @ApiProperty({ description: 'UUID of the customer' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'UUID of the current account product' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'UUID of the branch' })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
