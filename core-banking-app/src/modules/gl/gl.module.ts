import { Module } from '@nestjs/common';
import { TenantContextModule } from '@libs/common';
import { GlService } from './gl.service';
import { PostingEngine } from './posting-engine';
import { GlController } from './gl.controller';

@Module({
  imports: [TenantContextModule],
  controllers: [GlController],
  providers: [GlService, PostingEngine],
  exports: [GlService, PostingEngine],
})
export class GlModule {}
