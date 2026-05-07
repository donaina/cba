import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TenantContextModule } from '@libs/common';
import { NibssService } from './nibss.service';
import { NibssController } from './nibss.controller';

@Module({
  imports: [HttpModule, TenantContextModule],
  controllers: [NibssController],
  providers: [NibssService],
  exports: [NibssService],
})
export class NibssModule {}
