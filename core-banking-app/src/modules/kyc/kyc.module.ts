import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TenantContextModule } from '@libs/common';
import { BvnService } from './bvn.service';
import { CreditBureauService } from './credit-bureau.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [HttpModule, TenantContextModule],
  controllers: [KycController],
  providers: [BvnService, CreditBureauService],
  exports: [BvnService, CreditBureauService],
})
export class KycModule {}
