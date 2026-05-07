import { Module } from '@nestjs/common';
import { FixedDepositService } from './fixed-deposit.service';
import { FixedDepositController } from './fixed-deposit.controller';
import { FdMaturityJob } from './fd-maturity.job';
import { GlModule } from '@modules/gl/gl.module';
import { TenantContextModule } from '@libs/common';

@Module({
  imports: [GlModule, TenantContextModule],
  providers: [FixedDepositService, FdMaturityJob],
  controllers: [FixedDepositController],
  exports: [FixedDepositService],
})
export class FixedDepositModule {}
