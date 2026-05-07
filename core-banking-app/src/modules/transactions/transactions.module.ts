import { Module } from '@nestjs/common';
import { GlModule } from '@modules/gl/gl.module';
import { AdminModule } from '@modules/admin/admin.module';
import { TenantContextModule } from '@libs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [GlModule, AdminModule, TenantContextModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
