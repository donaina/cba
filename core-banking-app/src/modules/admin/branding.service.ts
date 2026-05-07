import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import * as path from 'path';

@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);
  private readonly minioClient: MinioClient;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {
    this.bucket = process.env.MINIO_BUCKET ?? 'core-banking';
    this.minioClient = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    });
  }

  async uploadLogo(
    buffer: Buffer,
    mimeType: string,
    tenantId: string,
  ): Promise<void> {
    let processedBuffer: Buffer;
    let ext: string;

    if (mimeType === 'image/svg+xml') {
      processedBuffer = buffer;
      ext = 'svg';
    } else {
      const sharpInstance = sharp(buffer);
      const resized = sharpInstance.resize(400, 200, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      if (mimeType === 'image/png') {
        processedBuffer = await resized.png().toBuffer();
        ext = 'png';
      } else if (mimeType === 'image/webp') {
        processedBuffer = await resized.webp().toBuffer();
        ext = 'webp';
      } else {
        // Default to JPEG for image/jpeg, image/jpg, etc.
        processedBuffer = await resized.jpeg().toBuffer();
        ext = 'jpg';
      }
    }

    const objectKey = `branding/${tenantId}/logo-${uuidv4()}.${ext}`;

    await this.minioClient.putObject(
      this.bucket,
      objectKey,
      processedBuffer,
      processedBuffer.length,
      { 'Content-Type': mimeType },
    );

    await this.prisma.organisation.update({
      where: { id: tenantId },
      data: {
        logoObjectKey: objectKey,
        logoMimeType: mimeType,
        logoUpdatedAt: new Date(),
      },
    });

    this.logger.log(`Logo uploaded for tenant ${tenantId}: ${objectKey}`);
  }

  async getLogoAsDataUri(tenantId: string): Promise<string | null> {
    const org = await this.prisma.organisation.findUnique({
      where: { id: tenantId },
      select: { logoObjectKey: true, logoMimeType: true },
    });

    if (!org || !org.logoObjectKey || !org.logoMimeType) {
      return null;
    }

    const stream = await this.minioClient.getObject(
      this.bucket,
      org.logoObjectKey,
    );

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const base64 = Buffer.concat(chunks).toString('base64');
    return `data:${org.logoMimeType};base64,${base64}`;
  }
}
