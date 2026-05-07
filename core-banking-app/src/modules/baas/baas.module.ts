import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TenantContextModule } from '@libs/common';
import { BaasService } from './baas.service';
import { BaasController } from './baas.controller';

@Module({
  imports: [HttpModule, TenantContextModule],
  controllers: [BaasController],
  providers: [BaasService],
  exports: [BaasService],
})
export class BaasModule {}
