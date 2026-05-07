import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { DocumentStatus } from '@prisma/client';
import { MinioService } from './minio.service';
import { CustomersService } from '../customers/customers.service';
import { ReviewDocumentDto } from './dto/review-document.dto';

const BUCKET = process.env.MINIO_DOCUMENTS_BUCKET ?? 'documents';

/** Derives a file extension from a mime type, e.g. "image/png" → "png". */
function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };
  return map[mimeType.toLowerCase()] ?? mimeType.split('/').pop() ?? 'bin';
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly minioService: MinioService,
    @Inject(forwardRef(() => CustomersService))
    private readonly customersService: CustomersService,
  ) {}

  async upload(
    customerId: string,
    documentType: string,
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ) {
    const { tenantId } = this.ctx;
    const ext = extFromMime(mimeType);
    const objectKey = `${tenantId}/${customerId}/${documentType}/${uuidv4()}.${ext}`;

    await this.minioService.uploadObject(BUCKET, objectKey, buffer, mimeType);

    return this.prisma.customerDocument.create({
      data: {
        tenantId,
        customerId,
        documentType: documentType as any,
        objectKey,
        mimeType,
        fileName,
        status: DocumentStatus.PENDING_REVIEW,
      },
    });
  }

  async listDocuments(customerId: string) {
    return this.prisma.customerDocument.findMany({
      where: {
        tenantId: this.ctx.tenantId,
        customerId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocument(id: string) {
    const doc = await this.prisma.customerDocument.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return doc;
  }

  async reviewDocument(id: string, dto: ReviewDocumentDto, reviewerId: string) {
    const doc = await this.getDocument(id);

    const isVerified = dto.status === 'VERIFIED';

    const updated = await this.prisma.customerDocument.update({
      where: { id },
      data: {
        status: dto.status as unknown as DocumentStatus,
        verifiedBy: isVerified ? reviewerId : null,
        verifiedAt: isVerified ? new Date() : null,
        rejectionNote: !isVerified ? (dto.rejectionNote ?? null) : null,
      },
    });

    if (isVerified) {
      await this.customersService.checkAndUpgradeKycTier(doc.customerId);
    }

    return updated;
  }

  async deleteDocument(id: string) {
    const doc = await this.getDocument(id);

    if (doc.status === DocumentStatus.VERIFIED) {
      throw new BadRequestException('Cannot delete a verified document');
    }

    return this.prisma.customerDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getPresignedUrl(id: string): Promise<string> {
    const doc = await this.prisma.customerDocument.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return this.minioService.getPresignedUrl(BUCKET, doc.objectKey, 3600);
  }
}
