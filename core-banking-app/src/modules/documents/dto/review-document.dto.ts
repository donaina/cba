import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DocumentStatus {
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class ReviewDocumentDto {
  @ApiProperty({ enum: DocumentStatus, description: 'Compliance review outcome' })
  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @ApiPropertyOptional({ example: 'Document is expired', description: 'Required when status is REJECTED' })
  @IsOptional()
  @IsString()
  rejectionNote?: string;
}
