import { Module } from '@nestjs/common';
import { TenantContextModule } from '@libs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BrandingService } from './branding.service';
import { MakerCheckerService } from './maker-checker.service';

@Module({
  imports: [TenantContextModule],
  controllers: [AdminController],
  providers: [AdminService, BrandingService, MakerCheckerService],
  exports: [MakerCheckerService, BrandingService],
})
export class AdminModule {}
