import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class VerifyBvnDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'BVN must be exactly 10 digits' })
  bvn: string;
}
