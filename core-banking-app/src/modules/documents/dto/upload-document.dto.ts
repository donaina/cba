import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DocumentType {
  PASSPORT = 'PASSPORT',
  NATIONAL_ID = 'NATIONAL_ID',
  DRIVERS_LICENCE = 'DRIVERS_LICENCE',
  UTILITY_BILL = 'UTILITY_BILL',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  BVN_SLIP = 'BVN_SLIP',
  CAC_CERTIFICATE = 'CAC_CERTIFICATE',
  MEMORANDUM_OF_ASSOCIATION = 'MEMORANDUM_OF_ASSOCIATION',
  BOARD_RESOLUTION = 'BOARD_RESOLUTION',
  PHOTO = 'PHOTO',
}

export class UploadDocumentDto {
  @ApiProperty({ description: 'Customer UUID this document belongs to' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ enum: DocumentType, description: 'KYC document type' })
  @IsEnum(DocumentType)
  documentType: DocumentType;
}
