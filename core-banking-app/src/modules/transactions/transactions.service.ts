import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@libs/database';
import {
  TenantContext,
  FeeCalculator,
  NubanUtil,
} from '@libs/common';
import { EntryType, TransactionCategory, TransactionStatus } from '@prisma/client';
import { PostingEngine } from '@modules/gl/posting-engine';
import { GlService } from '@modules/gl/gl.service';
import { MakerCheckerService } from '@modules/admin/maker-checker.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { IntraTransferDto } from './dto/intra-transfer.dto';
import { NipTransferDto } from './dto/nip-transfer.dto';

const CTR_THRESHOLD = new Decimal('5000000');

function randomRef(prefix: string): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${Date.now()}-${rand}`;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly postingEngine: PostingEngine,
    private readonly glService: GlService,
    private readonly makerCheckerService: MakerCheckerService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findActiveAccount(accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, tenantId: this.ctx.tenantId },
    });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    if (account.status === 'CLOSED') throw new BadRequestException('Account is closed');
    if (account.isFrozen) throw new BadRequestException('Account is frozen');
    return account;
  }

  private async getFeeConfig(transactionType: string) {
    return this.prisma.transactionTypeConfig.findFirst({
      where: { tenantId: this.ctx.tenantId, code: transactionType, isActive: true },
    });
  }

  private async getVatRate(): Promise<Decimal> {
    const tax = await this.prisma.taxConfiguration.findFirst({
      where: { tenantId: this.ctx.tenantId, taxType: 'VAT', isActive: true },
    });
    return tax ? new Decimal(tax.rate.toString()) : new Decimal('0.075');
  }

  private async fireCtrInsideTx(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    transactionId: string,
    customerId: string,
    amount: Decimal,
  ): Promise<void> {
    if (amount.gte(CTR_THRESHOLD)) {
      await tx.regulatoryReport.create({
        data: {
          tenantId: this.ctx.tenantId,
          reportType: 'CTR',
          transactionId,
          customerId,
          amount,
          narrative: `Auto-filed CTR for transaction ${transactionId} of amount ${amount.toFixed(2)}`,
          status: 'PENDING',
        },
      });
    }
  }

  // ─── OTC Deposit ─────────────────────────────────────────────────────────

  async otcDeposit(dto: DepositDto, idempotencyKey?: string) {
    const account = await this.findActiveAccount(dto.accountId);
    const amount = new Decimal(dto.amount);
    const feeConfig = await this.getFeeConfig('OTC_DEPOSIT');
    const vatRate = await this.getVatRate();

    const zeroFeeConfig = {
      flatFee: '0',
      percentageFee: '0',
      minFee: '0',
      maxFee: '0',
      vatApplicable: false,
      whtApplicable: false,
    };

    const fee = feeConfig
      ? FeeCalculator.calculate(amount, feeConfig as any, vatRate)
      : FeeCalculator.calculate(amount, zeroFeeConfig, vatRate);

    const channel = dto.channel ?? 'OTC';
    const needsApproval = await this.makerCheckerService.requiresApproval(
      'TRANSACTIONS',
      'OTC_DEPOSIT',
      amount,
      channel,
    );

    if (needsApproval) {
      const request = await this.makerCheckerService.createRequest(
        'TRANSACTIONS',
        'OTC_DEPOSIT',
        { ...dto, idempotencyKey },
      );
      return { status: 'PENDING_APPROVAL', makerCheckerRequestId: request.id };
    }

    const reference = randomRef('DEP');

    const entries: Array<{ glCode: string; entryType: EntryType; amount: Decimal; narration?: string; accountId?: string }> = [
      { glCode: 'VAULT_CASH', entryType: EntryType.DEBIT, amount },
      {
        glCode: this.glService.getGlControlAccount(account.accountType),
        entryType: EntryType.CREDIT,
        amount: amount.minus(fee.totalFee),
        accountId: account.id,
      },
    ];

    if (fee.baseFee.gt(0)) {
      entries.push({ glCode: 'FEE_INCOME', entryType: EntryType.CREDIT, amount: fee.baseFee });
    }
    if (fee.vat.gt(0)) {
      entries.push({ glCode: 'VAT_PAYABLE', entryType: EntryType.CREDIT, amount: fee.vat });
    }

    const txRecord = await this.prisma.$transaction(
      async (tx) => {
        const record = await this.postingEngine.post({
          reference,
          category: TransactionCategory.OTC_DEPOSIT,
          narration: dto.narration ?? `OTC Deposit to ${account.accountNumber}`,
          channel,
          initiatedBy: this.ctx.userId,
          idempotencyKey,
          entries,
        });

        await tx.account.update({
          where: { id: account.id },
          data: {
            currentBalance: { increment: amount },
            availableBalance: { increment: amount.minus(fee.totalFee) },
          },
        });

        await this.fireCtrInsideTx(tx, record.id, account.customerId, amount);

        return record;
      },
      { isolationLevel: 'Serializable' },
    );

    return txRecord;
  }

  // ─── OTC Withdrawal ──────────────────────────────────────────────────────

  async otcWithdrawal(dto: WithdrawDto, idempotencyKey?: string) {
    const account = await this.findActiveAccount(dto.accountId);
    const amount = new Decimal(dto.amount);

    if (new Decimal(account.availableBalance.toString()).lt(amount)) {
      throw new BadRequestException('Insufficient available balance');
    }

    const feeConfig = await this.getFeeConfig('OTC_WITHDRAWAL');
    const vatRate = await this.getVatRate();

    const zeroFeeConfig = {
      flatFee: '0',
      percentageFee: '0',
      minFee: '0',
      maxFee: '0',
      vatApplicable: false,
      whtApplicable: false,
    };

    const fee = feeConfig
      ? FeeCalculator.calculate(amount, feeConfig as any, vatRate)
      : FeeCalculator.calculate(amount, zeroFeeConfig, vatRate);

    const channel = dto.channel ?? 'OTC';
    const needsApproval = await this.makerCheckerService.requiresApproval(
      'TRANSACTIONS',
      'OTC_WITHDRAWAL',
      amount,
      channel,
    );

    if (needsApproval) {
      const request = await this.makerCheckerService.createRequest(
        'TRANSACTIONS',
        'OTC_WITHDRAWAL',
        { ...dto, idempotencyKey },
      );
      return { status: 'PENDING_APPROVAL', makerCheckerRequestId: request.id };
    }

    const reference = randomRef('WDR');

    const entries: Array<{ glCode: string; entryType: EntryType; amount: Decimal; narration?: string; accountId?: string }> = [
      {
        glCode: this.glService.getGlControlAccount(account.accountType),
        entryType: EntryType.DEBIT,
        amount: amount.plus(fee.totalFee),
        accountId: account.id,
      },
      { glCode: 'VAULT_CASH', entryType: EntryType.CREDIT, amount },
    ];

    if (fee.baseFee.gt(0)) {
      entries.push({ glCode: 'FEE_INCOME', entryType: EntryType.CREDIT, amount: fee.baseFee });
    }
    if (fee.vat.gt(0)) {
      entries.push({ glCode: 'VAT_PAYABLE', entryType: EntryType.CREDIT, amount: fee.vat });
    }

    const txRecord = await this.prisma.$transaction(
      async (tx) => {
        const record = await this.postingEngine.post({
          reference,
          category: TransactionCategory.OTC_WITHDRAWAL,
          narration: dto.narration ?? `OTC Withdrawal from ${account.accountNumber}`,
          channel,
          initiatedBy: this.ctx.userId,
          idempotencyKey,
          entries,
        });

        await tx.account.update({
          where: { id: account.id },
          data: {
            currentBalance: { decrement: amount },
            availableBalance: { decrement: amount.plus(fee.totalFee) },
          },
        });

        await this.fireCtrInsideTx(tx, record.id, account.customerId, amount);

        return record;
      },
      { isolationLevel: 'Serializable' },
    );

    return txRecord;
  }

  // ─── Intra Transfer ──────────────────────────────────────────────────────

  async intraTransfer(dto: IntraTransferDto, idempotencyKey?: string) {
    const [fromAccount, toAccount] = await Promise.all([
      this.findActiveAccount(dto.fromAccountId),
      this.findActiveAccount(dto.toAccountId),
    ]);

    const amount = new Decimal(dto.amount);
    const feeConfig = await this.getFeeConfig('INTRA_TRANSFER');
    const vatRate = await this.getVatRate();
    const zeroFeeConfig = { flatFee: '0', percentageFee: '0', minFee: '0', maxFee: '0', vatApplicable: false, whtApplicable: false };
    const fee = feeConfig
      ? FeeCalculator.calculate(amount, feeConfig as any, vatRate)
      : FeeCalculator.calculate(amount, zeroFeeConfig, vatRate);

    const totalDebit = amount.plus(fee.totalFee);

    if (new Decimal(fromAccount.availableBalance.toString()).lt(totalDebit)) {
      throw new BadRequestException('Insufficient available balance in source account');
    }

    const channel = dto.channel ?? 'OTC';
    const needsApproval = await this.makerCheckerService.requiresApproval(
      'TRANSACTIONS',
      'INTRA_TRANSFER',
      amount,
      channel,
    );
    if (needsApproval) {
      const request = await this.makerCheckerService.createRequest('TRANSACTIONS', 'INTRA_TRANSFER', { ...dto, idempotencyKey });
      return { status: 'PENDING_APPROVAL', makerCheckerRequestId: request.id };
    }

    const reference = randomRef('TRF');

    const txRecord = await this.prisma.$transaction(
      async (tx) => {
        const record = await this.postingEngine.post({
          reference,
          category: TransactionCategory.INTRA_TRANSFER,
          narration:
            dto.narration ??
            `Intra transfer from ${fromAccount.accountNumber} to ${toAccount.accountNumber}`,
          initiatedBy: this.ctx.userId,
          idempotencyKey,
          entries: [
            {
              glCode: this.glService.getGlControlAccount(fromAccount.accountType),
              entryType: EntryType.DEBIT,
              amount: totalDebit,
              accountId: fromAccount.id,
            },
            {
              glCode: this.glService.getGlControlAccount(toAccount.accountType),
              entryType: EntryType.CREDIT,
              amount,
              accountId: toAccount.id,
            },
            ...(fee.baseFee.gt(0) ? [{ glCode: 'FEE_INCOME', entryType: EntryType.CREDIT, amount: fee.baseFee }] : []),
            ...(fee.vat.gt(0) ? [{ glCode: 'VAT_PAYABLE', entryType: EntryType.CREDIT, amount: fee.vat }] : []),
          ],
        });

        await tx.account.update({
          where: { id: fromAccount.id },
          data: {
            currentBalance: { decrement: totalDebit },
            availableBalance: { decrement: totalDebit },
          },
        });

        await tx.account.update({
          where: { id: toAccount.id },
          data: {
            currentBalance: { increment: amount },
            availableBalance: { increment: amount },
          },
        });

        return record;
      },
      { isolationLevel: 'Serializable' },
    );

    return txRecord;
  }

  // ─── NIP Transfer ─────────────────────────────────────────────────────────

  async nipTransfer(dto: NipTransferDto, idempotencyKey?: string) {
    const isValid = NubanUtil.validate(dto.beneficiaryBankCode, dto.beneficiaryAccountNumber);
    if (!isValid) {
      throw new BadRequestException('Invalid NUBAN account number');
    }

    const account = await this.findActiveAccount(dto.fromAccountId);
    const amount = new Decimal(dto.amount);
    const nipFee = FeeCalculator.nipFee(amount);
    const vatRate = await this.getVatRate();
    const vat = nipFee.times(vatRate).toDecimalPlaces(4);
    const totalDebit = amount.plus(nipFee).plus(vat);

    if (new Decimal(account.availableBalance.toString()).lt(totalDebit)) {
      throw new BadRequestException('Insufficient available balance to cover transfer and fees');
    }

    const reference = randomRef('NIP');

    const txRecord = await this.prisma.$transaction(
      async (tx) => {
        // Stage 1: Debit customer, credit NIBSS_SUSPENSE
        const record = await this.postingEngine.post({
          reference,
          category: TransactionCategory.INTER_BANK_TRANSFER,
          narration:
            dto.narration ??
            `NIP transfer to ${dto.beneficiaryAccountNumber} at bank ${dto.beneficiaryBankCode}`,
          initiatedBy: this.ctx.userId,
          idempotencyKey,
          entries: [
            {
              glCode: this.glService.getGlControlAccount(account.accountType),
              entryType: EntryType.DEBIT,
              amount,
              narration: 'Customer debit for NIP transfer',
              accountId: account.id,
            },
            {
              glCode: 'NIBSS_SUSPENSE',
              entryType: EntryType.CREDIT,
              amount,
              narration: 'Hold in NIBSS suspense',
            },
          ],
        });

        // Fee posting
        if (nipFee.gt(0)) {
          await this.postingEngine.post({
            reference: `${reference}-FEE`,
            category: TransactionCategory.FEE_CHARGE,
            narration: 'NIP transfer fee',
            initiatedBy: this.ctx.userId,
            entries: [
              {
                glCode: this.glService.getGlControlAccount(account.accountType),
                entryType: EntryType.DEBIT,
                amount: nipFee.plus(vat),
                narration: 'Fee + VAT debit from customer',
              },
              {
                glCode: 'NIP_FEE_INCOME',
                entryType: EntryType.CREDIT,
                amount: nipFee,
                narration: 'NIP fee income',
              },
              ...(vat.gt(0)
                ? [
                    {
                      glCode: 'VAT_PAYABLE',
                      entryType: EntryType.CREDIT,
                      amount: vat,
                      narration: 'VAT on NIP fee',
                    },
                  ]
                : []),
            ],
          });
        }

        await tx.account.update({
          where: { id: account.id },
          data: {
            currentBalance: { decrement: totalDebit },
            availableBalance: { decrement: totalDebit },
          },
        });

        // Create NibssSession
        await tx.nibssSession.create({
          data: {
            tenantId: this.ctx.tenantId,
            sessionId: reference,
            direction: 'OUTWARD',
            amount,
            senderAccount: account.accountNumber,
            beneficiaryAccount: dto.beneficiaryAccountNumber,
            beneficiaryBank: dto.beneficiaryBankCode,
            narration: dto.narration ?? null,
            status: 'PENDING',
            transactionId: record.id,
          },
        });

        return record;
      },
      { isolationLevel: 'Serializable' },
    );

    return { status: 'PENDING', transactionId: txRecord.id, reference };
  }

  // ─── Confirm NIP Outward ─────────────────────────────────────────────────

  async confirmNipOutward(
    sessionId: string,
    nibssResponse: object,
    success: boolean,
  ) {
    const session = await this.prisma.nibssSession.findFirst({
      where: { sessionId, tenantId: this.ctx.tenantId },
    });

    if (!session) throw new NotFoundException(`NibssSession ${sessionId} not found`);

    const amount = new Decimal(session.amount.toString());

    if (success) {
      await this.prisma.$transaction(
        async (tx) => {
          await this.postingEngine.post({
            reference: randomRef('NIP-SETTLE'),
            category: TransactionCategory.INTER_BANK_TRANSFER,
            narration: `NIP settlement for session ${sessionId}`,
            entries: [
              {
                glCode: 'NIBSS_SUSPENSE',
                entryType: EntryType.DEBIT,
                amount,
              },
              {
                glCode: 'NIBSS_SETTLEMENT',
                entryType: EntryType.CREDIT,
                amount,
              },
            ],
          });

          await tx.nibssSession.update({
            where: { id: session.id },
            data: { status: 'COMPLETED', nibssResponse },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } else {
      // Reverse: return principal + fees to customer
      const account = session.senderAccount
        ? await this.prisma.account.findFirst({
            where: {
              accountNumber: session.senderAccount,
              tenantId: this.ctx.tenantId,
            },
          })
        : null;

      // Recalculate fee to know total refund amount
      const nipFee = FeeCalculator.nipFee(amount);
      const vatRate = await this.getVatRate();
      const vat = nipFee.times(vatRate).toDecimalPlaces(4);
      const totalRefund = amount.plus(nipFee).plus(vat);

      await this.prisma.$transaction(
        async (tx) => {
          // Reverse principal: NIBSS_SUSPENSE → customer control
          await this.postingEngine.post({
            reference: randomRef('NIP-REV'),
            category: TransactionCategory.REVERSAL,
            narration: `NIP reversal for failed session ${sessionId}`,
            entries: [
              {
                glCode: 'NIBSS_SUSPENSE',
                entryType: EntryType.DEBIT,
                amount,
              },
              {
                glCode: this.glService.getGlControlAccount(account!.accountType),
                entryType: EntryType.CREDIT,
                amount,
                accountId: account?.id,
              },
            ],
          });

          // Reverse fees: FEE_INCOME + VAT_PAYABLE → customer control
          if (nipFee.gt(0)) {
            await this.postingEngine.post({
              reference: randomRef('NIP-REV-FEE'),
              category: TransactionCategory.REVERSAL,
              narration: `NIP fee reversal for failed session ${sessionId}`,
              entries: [
                { glCode: 'NIP_FEE_INCOME', entryType: EntryType.DEBIT, amount: nipFee },
                ...(vat.gt(0) ? [{ glCode: 'VAT_PAYABLE', entryType: EntryType.DEBIT, amount: vat }] : []),
                {
                  glCode: this.glService.getGlControlAccount(account!.accountType),
                  entryType: EntryType.CREDIT,
                  amount: nipFee.plus(vat),
                  accountId: account?.id,
                },
              ],
            });
          }

          if (account) {
            await tx.account.update({
              where: { id: account.id },
              data: {
                currentBalance: { increment: totalRefund },
                availableBalance: { increment: totalRefund },
              },
            });
          }

          await tx.nibssSession.update({
            where: { id: session.id },
            data: { status: 'REVERSED', nibssResponse },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    }

    return { sessionId, success };
  }

  // ─── Reverse Transaction ─────────────────────────────────────────────────

  async reverse(transactionId: string, reversedBy: string) {
    const original = await this.prisma.transactionRecord.findFirst({
      where: { id: transactionId, tenantId: this.ctx.tenantId },
      include: { entries: true },
    });

    if (!original) throw new NotFoundException(`Transaction ${transactionId} not found`);
    if (original.reversedBy) throw new BadRequestException('Transaction already reversed');
    if (original.reversalOf) throw new BadRequestException('Cannot reverse a reversal');

    const reference = randomRef('REV');

    // Flip all entries
    const reversalEntries = (original as any).entries.map((e: any) => ({
      glCode: e.glAccountId,
      entryType: e.entryType === EntryType.DEBIT ? EntryType.CREDIT : EntryType.DEBIT,
      amount: new Decimal(e.amount.toString()),
      narration: `Reversal of ${transactionId}`,
    }));

    const reversal = await this.prisma.$transaction(
      async (tx) => {
        const reversalRecord = await this.postingEngine.post({
          reference,
          category: TransactionCategory.REVERSAL,
          narration: `Reversal of transaction ${transactionId}`,
          initiatedBy: this.ctx.userId,
          entries: reversalEntries,
        });

        await tx.transactionRecord.update({
          where: { id: transactionId },
          data: { reversedBy, status: TransactionStatus.REVERSED },
        });

        await tx.transactionRecord.update({
          where: { id: reversalRecord.id },
          data: { reversalOf: transactionId },
        });

        return reversalRecord;
      },
      { isolationLevel: 'Serializable' },
    );

    return reversal;
  }

  // ─── Get pending approvals ────────────────────────────────────────────────

  async getPendingApprovals() {
    return this.prisma.makerCheckerRequest.findMany({
      where: {
        tenantId: this.ctx.tenantId,
        module: 'TRANSACTIONS',
        status: 'PENDING_APPROVAL',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Get by ID ───────────────────────────────────────────────────────────

  async findById(id: string) {
    const record = await this.prisma.transactionRecord.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
      include: { entries: true },
    });
    if (!record) throw new NotFoundException(`Transaction ${id} not found`);
    return record;
  }
}
