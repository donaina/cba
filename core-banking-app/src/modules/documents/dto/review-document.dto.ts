import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DocumentStatus {
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class ReviewDocumentDto {
  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @IsOptional()
  @IsString()
  rejectionNote?: string;
}
