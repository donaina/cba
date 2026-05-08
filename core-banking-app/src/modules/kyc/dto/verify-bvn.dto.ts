import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyBvnDto {
  @ApiProperty({ description: 'Customer UUID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '2200123456', description: '10-digit BVN (verified via NIBSS)' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'BVN must be exactly 10 digits' })
  bvn: string;
}
