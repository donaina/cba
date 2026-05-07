import { IsString, IsArray, IsOptional } from 'class-validator';

export class FileStrDto {
  @IsString()
  customerId: string;

  @IsArray()
  transactionIds: string[];

  @IsString()
  narrative: string;

  @IsOptional()
  @IsString()
  alertId?: string;
}
