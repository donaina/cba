import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@bank.ng', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@1234', minLength: 8, description: 'User password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'NB001', description: 'Tenant code of the bank (required for multi-tenant login)' })
  @IsOptional()
  @IsString()
  tenantCode?: string;
}
