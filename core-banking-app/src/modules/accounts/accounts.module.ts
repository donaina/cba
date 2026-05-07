import { Module } from '@nestjs/common';
import { SavingsModule } from './savings/savings.module';
import { CurrentModule } from './current/current.module';
import { FixedDepositModule } from './fixed-deposit/fixed-deposit.module';
import { AccountsController } from './accounts.controller';
import { DatabaseModule } from '@libs/database';
import { CommonModule } from '@libs/common';

@Module({
  imports: [DatabaseModule, CommonModule, SavingsModule, CurrentModule, FixedDepositModule],
  controllers: [AccountsController],
  exports: [SavingsModule, CurrentModule, FixedDepositModule],
})
export class AccountsModule {}
