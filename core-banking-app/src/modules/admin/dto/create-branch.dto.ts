import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum BranchType {
  HEAD_OFFICE = 'HEAD_OFFICE',
  BRANCH = 'BRANCH',
  AGENCY = 'AGENCY',
}

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(BranchType)
  branchType?: BranchType;
}
