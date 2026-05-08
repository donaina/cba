import { IsEnum, IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TaxType {
  VAT = 'VAT',
  WHT = 'WHT',
  STAMP_DUTY = 'STAMP_DUTY',
}

export class SetTaxRateDto {
  @ApiProperty({ enum: TaxType, description: 'Tax type to configure' })
  @IsEnum(TaxType)
  taxType: TaxType;

  @ApiProperty({ example: '0.075', description: 'Rate as decimal string (e.g. 0.075 = 7.5% VAT)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'rate must be a positive decimal number string',
  })
  rate: string;

  @ApiProperty({ example: '2024-01-01', description: 'ISO 8601 date from which this rate takes effect' })
  @IsString()
  @IsNotEmpty()
  effectiveDate: string;
}
