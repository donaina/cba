import { IsEnum, IsString, IsNotEmpty, Matches } from 'class-validator';

export enum TaxType {
  VAT = 'VAT',
  WHT = 'WHT',
  STAMP_DUTY = 'STAMP_DUTY',
}

export class SetTaxRateDto {
  @IsEnum(TaxType)
  taxType: TaxType;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'rate must be a positive decimal number string',
  })
  rate: string;

  @IsString()
  @IsNotEmpty()
  effectiveDate: string;
}
