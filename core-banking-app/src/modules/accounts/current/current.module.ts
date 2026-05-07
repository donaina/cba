import { Module } from '@nestjs/common';
import { TenantContextModule } from '@libs/common';
import { CurrentService } from './current.service';
import { CurrentController } from './current.controller';

@Module({
  imports: [TenantContextModule],
  controllers: [CurrentController],
  providers: [CurrentService],
  exports: [CurrentService],
})
export class CurrentModule {}
