import { IsOptional, IsString, IsUUID } from 'class-validator';

export class OpenSavingsDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;
}
