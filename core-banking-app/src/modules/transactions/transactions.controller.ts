import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiHeader } from '@nestjs/swagger';
import { RequirePermission, TenantContext } from '@libs/common';
import { TransactionsService } from './transactions.service';
import { MakerCheckerService } from '@modules/admin/maker-checker.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { IntraTransferDto } from './dto/intra-transfer.dto';
import { NipTransferDto } from './dto/nip-transfer.dto';
import { ApproveTransactionDto } from './dto/approve-transaction.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly makerCheckerService: MakerCheckerService,
    private readonly ctx: TenantContext,
  ) {}

  @ApiOperation({ summary: 'Over-the-counter cash deposit' })
  @ApiHeader({ name: 'idempotency-key', required: false, description: 'Idempotency key (24-hour dedup)' })
  @ApiResponse({ status: 201, description: 'Deposit posted; VAULT_CASH debited, account credited' })
  @Post('deposit')
  @RequirePermission('txn:deposit')
  deposit(
    @Body() dto: DepositDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.otcDeposit(dto, idempotencyKey);
  }

  @ApiOperation({ summary: 'Over-the-counter cash withdrawal' })
  @ApiHeader({ name: 'idempotency-key', required: false, description: 'Idempotency key (24-hour dedup)' })
  @ApiResponse({ status: 201, description: 'Withdrawal posted; account debited, VAULT_CASH credited' })
  @Post('withdraw')
  @RequirePermission('txn:withdraw')
  withdraw(
    @Body() dto: WithdrawDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.otcWithdrawal(dto, idempotencyKey);
  }

  @ApiOperation({ summary: 'Intra-bank account-to-account transfer' })
  @ApiHeader({ name: 'idempotency-key', required: false, description: 'Idempotency key (24-hour dedup)' })
  @Post('transfer')
  @RequirePermission('txn:transfer')
  transfer(
    @Body() dto: IntraTransferDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.intraTransfer(dto, idempotencyKey);
  }

  @ApiOperation({ summary: 'NIP inter-bank transfer via NIBSS' })
  @ApiHeader({ name: 'idempotency-key', required: false, description: 'Idempotency key (24-hour dedup)' })
  @ApiResponse({ status: 201, description: 'NIP transfer initiated; customer debited, NIBSS_SUSPENSE credited' })
  @Post('nip-transfer')
  @RequirePermission('txn:transfer')
  nipTransfer(
    @Body() dto: NipTransferDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transactionsService.nipTransfer(dto, idempotencyKey);
  }

  @ApiOperation({ summary: 'Approve a pending maker-checker transaction' })
  @ApiResponse({ status: 200, description: 'Transaction approved and executed; approver must differ from initiator' })
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

  @ApiOperation({ summary: 'Reject a pending maker-checker transaction' })
  @ApiParam({ name: 'id', description: 'Maker-checker request UUID' })
  @Post(':id/reject')
  @RequirePermission('txn:approve')
  reject(@Param('id') id: string, @Body() dto: { note: string }) {
    return this.makerCheckerService.reject(id, this.ctx.userId, dto.note);
  }

  @ApiOperation({ summary: 'Reverse a posted transaction' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @Post('reverse/:id')
  @RequirePermission('txn:reverse')
  reverse(@Param('id') id: string) {
    return this.transactionsService.reverse(id, this.ctx.userId);
  }

  @ApiOperation({ summary: 'List transactions pending maker-checker approval' })
  @Get('pending-approvals')
  @RequirePermission('txn:approve')
  getPendingApprovals() {
    return this.transactionsService.getPendingApprovals();
  }

  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @Get(':id')
  @RequirePermission('txn:deposit')
  findById(@Param('id') id: string) {
    return this.transactionsService.findById(id);
  }
}
