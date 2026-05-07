import { Module } from '@nestjs/common';
import { GlModule } from '@modules/gl/gl.module';
import { TenantContextModule } from '@libs/common';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { LoanEodJob } from './loan-eod.job';

@Module({
  imports: [GlModule, TenantContextModule],
  providers: [LoansService, LoanEodJob],
  controllers: [LoansController],
  exports: [LoansService],
})
export class LoansModule {}
