import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'SENIOR_TELLER' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Senior teller with higher limits' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['txn:deposit', 'txn:withdraw'], description: 'Full replacement list of permission codes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
