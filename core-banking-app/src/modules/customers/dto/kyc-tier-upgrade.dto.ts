import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class KycTierUpgradeDto {
  @ApiPropertyOptional({ example: 'All Tier 2 documents verified', description: 'Optional note for the tier upgrade audit trail' })
  @IsString()
  @IsOptional()
  note?: string;
}
