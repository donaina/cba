import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  Matches,
  IsDateString,
} from 'class-validator';

export enum CustomerType {
  INDIVIDUAL = 'INDIVIDUAL',
  CORPORATE = 'CORPORATE',
}

export class CreateCustomerDto {
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType = CustomerType.INDIVIDUAL;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'BVN must be 11 digits' })
  bvn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'NIN must be 11 digits' })
  nin?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
