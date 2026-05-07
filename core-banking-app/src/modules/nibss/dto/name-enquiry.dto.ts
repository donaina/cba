import { IsString, Length } from 'class-validator';

export class NameEnquiryDto {
  @IsString()
  @Length(10, 10)
  accountNumber: string;

  @IsString()
  @Length(3, 3)
  bankCode: string;
}
