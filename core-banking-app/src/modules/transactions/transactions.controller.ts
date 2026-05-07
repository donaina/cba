import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { RequirePermission, TenantContext } from '@libs/common';
import { TransactionsService } from './transactions.service';
import { MakerCheckerService } from '@modules/admin/maker-checker.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { IntraTransferDto } from './dto/intra-transfer.dto';
import { NipTransferDto } from './dto/nip-transfer.dto';
import { ApproveTransactionDto } from './dto/approve-transaction.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly makerCheckerService: MakerCheckerService,
    private readonly ctx: TenantContext,
  ) {}

  @Post('deposit')
  @RequirePermission('txn:deposit')
  deposit(
    @Body() dto: DepositDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.otcDeposit(dto, idempotencyKey);
  }

  @Post('withdraw')
  @RequirePermission('txn:withdraw')
  withdraw(
    @Body() dto: WithdrawDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.otcWithdrawal(dto, idempotencyKey);
  }

  @Post('transfer')
  @RequirePermission('txn:transfer')
  transfer(
    @Body() dto: IntraTransferDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.intraTransfer(dto, idempotencyKey);
  }

  @Post('nip-transfer')
  @RequirePermission('txn:transfer')
  nipTransfer(
    @Body() dto: NipTransferDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.nipTransfer(dto, idempotencyKey);
  }

  @Post('approve')
  @RequirePermission('txn:approve')
  async approve(@Body() dto: ApproveTransactionDto) {
    const requestId = dto.makerCheckerRequestId ?? dto.transactionId;
    const request = await this.makerCheckerService.findById(requestId!);

    return this.makerCheckerService.approve(requestId!, this.ctx.userId, async (payload) => {
      switch (request.action) {
        case 'OTC_DEPOSIT':
          return this.transactionsService.otcDeposit(payload, payload.idempotencyKey);
        case 'OTC_WITHDRAWAL':
          return this.transactionsService.otcWithdrawal(payload, payload.idempotencyKey);
        case 'INTRA_TRANSFER':
          return this.transactionsService.intraTransfer(payload, payload.idempotencyKey);
        default:
          return null;
      }
    });
  }

  @Post(':id/reject')
  @RequirePermission('txn:approve')
  reject(@Param('id') id: string, @Body() dto: { note: string }) {
    return this.makerCheckerService.reject(id, this.ctx.userId, dto.note);
  }

  @Post('reverse/:id')
  @RequirePermission('txn:reverse')
  reverse(@Param('id') id: string) {
    return this.transactionsService.reverse(id, this.ctx.userId);
  }

  @Get('pending-approvals')
  @RequirePermission('txn:approve')
  getPendingApprovals() {
    return this.transactionsService.getPendingApprovals();
  }

  @Get(':id')
  @RequirePermission('txn:deposit')
  findById(@Param('id') id: string) {
    return this.transactionsService.findById(id);
  }
}
