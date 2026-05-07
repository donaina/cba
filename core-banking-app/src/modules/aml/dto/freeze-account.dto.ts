import { IsString, IsOptional } from 'class-validator';

export class FreezeAccountDto {
  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  note: string;
}
