import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BranchType {
  HEAD_OFFICE = 'HEAD_OFFICE',
  BRANCH = 'BRANCH',
  AGENCY = 'AGENCY',
}

export class CreateBranchDto {
  @ApiProperty({ example: 'Lagos Island Branch', description: 'Branch name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'LGS001', description: 'Unique branch code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: '1 Marina Road, Lagos', description: 'Branch physical address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: BranchType, default: BranchType.BRANCH })
  @IsOptional()
  @IsEnum(BranchType)
  branchType?: BranchType;
}
