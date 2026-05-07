import { Module } from '@nestjs/common';
import { TenantContextModule } from '@libs/common';
import { AdminModule } from '@modules/admin/admin.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { StatementPdfService } from './statement-pdf.service';

@Module({
  imports: [TenantContextModule, AdminModule],
  controllers: [ReportsController],
  providers: [ReportsService, StatementPdfService],
  exports: [ReportsService],
})
export class ReportsModule {}
