import { IsString, IsOptional } from 'class-validator';

export class KycTierUpgradeDto {
  @IsString()
  @IsOptional()
  note?: string;
}
