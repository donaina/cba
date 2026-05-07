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
import { RequirePermission, TenantContext } from '@libs/common';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly ctx: TenantContext,
  ) {}

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

  @Get('customer/:customerId')
  @RequirePermission('customer:read')
  listDocuments(@Param('customerId') customerId: string) {
    return this.documentsService.listDocuments(customerId);
  }

  @Get(':id/download')
  @RequirePermission('customer:read')
  async getPresignedUrl(@Param('id') id: string) {
    const url = await this.documentsService.getPresignedUrl(id);
    return { url };
  }

  @Patch(':id/review')
  @RequirePermission('compliance:alert')
  reviewDocument(
    @Param('id') id: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.documentsService.reviewDocument(id, dto, this.ctx.userId);
  }

  @Delete(':id')
  @RequirePermission('customer:update')
  deleteDocument(@Param('id') id: string) {
    return this.documentsService.deleteDocument(id);
  }
}
