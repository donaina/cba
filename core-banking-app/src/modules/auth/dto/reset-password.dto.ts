import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'admin@bank.ng' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP sent to email' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp: string;

  @ApiProperty({ example: 'NewSecure@1234', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
