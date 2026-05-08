import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { RequirePermission, TenantContext } from '@libs/common';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly ctx: TenantContext,
  ) {}

  @ApiOperation({ summary: 'Upload a KYC document for a customer' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded to MinIO' })
  @Post('upload')
  @RequirePermission('customer:update')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documentsService.upload(
      dto.customerId,
      dto.documentType,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
  }

  @ApiOperation({ summary: 'List documents for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer UUID' })
  @Get('customer/:customerId')
  @RequirePermission('customer:read')
  listDocuments(@Param('customerId') customerId: string) {
    return this.documentsService.listDocuments(customerId);
  }

  @ApiOperation({ summary: 'Get a presigned MinIO download URL for a document' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Presigned URL valid for a limited time' })
  @Get(':id/download')
  @RequirePermission('customer:read')
  async getPresignedUrl(@Param('id') id: string) {
    const url = await this.documentsService.getPresignedUrl(id);
    return { url };
  }

  @ApiOperation({ summary: 'Review (approve or reject) a KYC document' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @Patch(':id/review')
  @RequirePermission('compliance:alert')
  reviewDocument(
    @Param('id') id: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.documentsService.reviewDocument(id, dto, this.ctx.userId);
  }

  @ApiOperation({ summary: 'Delete a document from MinIO and the database' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @Delete(':id')
  @RequirePermission('customer:update')
  deleteDocument(@Param('id') id: string) {
    return this.documentsService.deleteDocument(id);
  }
}
