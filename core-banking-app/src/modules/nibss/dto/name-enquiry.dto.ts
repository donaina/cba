import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NameEnquiryDto {
  @ApiProperty({ example: '0123456789', description: '10-digit NUBAN account number' })
  @IsString()
  @Length(10, 10)
  accountNumber: string;

  @ApiProperty({ example: '058', description: '3-digit CBN bank code' })
  @IsString()
  @Length(3, 3)
  bankCode: string;
}
