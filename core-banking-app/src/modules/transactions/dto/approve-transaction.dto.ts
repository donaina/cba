import { IsString, IsOptional } from 'class-validator';

export class ApproveTransactionDto {
  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  makerCheckerRequestId?: string;
}
