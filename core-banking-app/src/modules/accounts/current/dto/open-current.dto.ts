import { IsOptional, IsUUID } from 'class-validator';

export class OpenCurrentDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;
}
