import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CustomerType {
  INDIVIDUAL = 'INDIVIDUAL',
  CORPORATE = 'CORPORATE',
}

export class CreateCustomerDto {
  @ApiPropertyOptional({ enum: CustomerType, default: CustomerType.INDIVIDUAL })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType = CustomerType.INDIVIDUAL;

  @ApiPropertyOptional({ example: 'Amina', description: 'Required for INDIVIDUAL customers' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Bello', description: 'Required for INDIVIDUAL customers' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Acme Ltd', description: 'Required for CORPORATE customers' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'amina@example.ng' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '08012345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: '12345678901', description: '11-digit Bank Verification Number' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'BVN must be 11 digits' })
  bvn?: string;

  @ApiPropertyOptional({ example: '12345678901', description: '11-digit National Identity Number' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'NIN must be 11 digits' })
  nin?: string;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'ISO 8601 date string' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
