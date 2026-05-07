import { forwardRef, Module } from '@nestjs/common';
import { TenantContextModule } from '@libs/common';
import { MinioService } from './minio.service';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    TenantContextModule,
    forwardRef(() => CustomersModule),
  ],
  providers: [MinioService, DocumentsService],
  controllers: [DocumentsController],
  exports: [MinioService, DocumentsService],
})
export class DocumentsModule {}
