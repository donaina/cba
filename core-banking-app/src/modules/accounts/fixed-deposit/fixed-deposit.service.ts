import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@libs/database';
import { NubanUtil, TenantContext } from '@libs/common';
import {
  Account,
  AccountStatus,
  AccountType,
  FdStatus,
  FixedDepositDetails,
  InterestPaymentFrequency,
  InterestPaymentType,
  LiquidationReason,
  MaturityInstruction,
  ProductType,
  TransactionCategory,
} from '@prisma/client';
import { PostingEngine } from '@modules/gl/posting-engine';
import { GlService } from '@modules/gl/gl.service';
import { OpenFdDto } from './dto/open-fd.dto';
import { LiquidateFdDto } from './dto/liquidate-fd.dto';

const DEFAULT_WHT_RATE = new Decimal('0.10');

/** Difference in whole days between two dates (floor). */
function diffDays(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

/** Add days to a date, returning a new Date. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Build periodic interest payment dates given tenor and frequency. */
function buildPeriodicDates(
  startDate: Date,
  tenorDays: number,
  frequency: InterestPaymentFrequency,
): Date[] {
  const frequencyDays: Record<InterestPaymentFrequency, number> = {
    MONTHLY: 30,
    QUARTERLY: 91,
    SEMI_ANNUALLY: 182,
    ANNUALLY: 365,
  };
  const step = frequencyDays[frequency];
  const maturity = addDays(startDate, tenorDays);
  const dates: Date[] = [];
  let cursor = addDays(startDate, step);
  while (cursor < maturity) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, step);
  }
  // Always include maturity date as final payment
  dates.push(maturity);
  return dates;
}

@Injectable()
export class FixedDepositService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly postingEngine: PostingEngine,
    private readonly glService: GlService,
  ) {}

  async openFd(dto: OpenFdDto): Promise<FixedDepositDetails & { account: Account }> {
    const { tenantId, branchId: ctxBranchId, userId } = this.ctx;
    const branchId = dto.branchId ?? ctxBranchId;

    // 1. Validate product
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, isActive: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }
    if (product.productType !== ProductType.FIXED_DEPOSIT) {
      throw new BadRequestException('Product is not a FIXED_DEPOSIT product');
    }

    // 2. Validate source account
    const sourceAccount = await this.prisma.account.findFirst({
      where: { id: dto.sourceAccountId, tenantId },
    });
    if (!sourceAccount) {
      throw new NotFoundException(`Source account ${dto.sourceAccountId} not found`);
    }
    if (sourceAccount.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Source account is not active');
    }
    if (sourceAccount.isFrozen) {
      throw new BadRequestException('Source account is frozen');
    }

    const principal = new Decimal(dto.principal);
    const negotiatedRate = new Decimal(dto.negotiatedRate);

    if (new Decimal(sourceAccount.availableBalance).lessThan(principal)) {
      throw new BadRequestException('Insufficient balance in source account');
    }

    // 3. Calculate interest
    const grossInterest = principal
      .times(negotiatedRate)
      .times(dto.tenorDays)
      .dividedBy(365)
      .toDecimalPlaces(4);
    const whtAmount = grossInterest.times(DEFAULT_WHT_RATE).toDecimalPlaces(4);
    const netInterest = grossInterest.minus(whtAmount);

    const startDate = new Date();
    const maturityDate = addDays(startDate, dto.tenorDays);

    // 4. Get organisation for NUBAN
    const org = await this.prisma.organisation.findUnique({
      where: { id: tenantId },
    });
    if (!org || !org.sortCode) {
      throw new BadRequestException('Organisation sort code not configured');
    }

    const count = await this.prisma.account.count({ where: { tenantId } });
    const accountNumber = NubanUtil.generate(org.sortCode, count + 1);
    const reference = `FD-OPEN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // 5. Serializable transaction
    return this.prisma.$transaction(
      async (tx) => {
        // a. Debit source account
        await tx.account.update({
          where: { id: dto.sourceAccountId },
          data: {
            currentBalance: { decrement: principal.toNumber() },
            availableBalance: { decrement: principal.toNumber() },
            ledgerBalance: { decrement: principal.toNumber() },
          },
        });

        // b. Create FD account
        const fdAccount = await tx.account.create({
          data: {
            tenantId,
            customerId: sourceAccount.customerId,
            productId: dto.productId,
            branchId,
            accountNumber,
            accountType: AccountType.FIXED_DEPOSIT,
            status: AccountStatus.ACTIVE,
            currentBalance: principal,
            availableBalance: principal,
            ledgerBalance: principal,
          },
        });

        // c. Create FixedDepositDetails
        const fd = await tx.fixedDepositDetails.create({
          data: {
            tenantId,
            accountId: fdAccount.id,
            sourceAccountId: dto.sourceAccountId,
            principal,
            negotiatedRate,
            tenorDays: dto.tenorDays,
            startDate,
            maturityDate,
            interestPaymentType: dto.interestPaymentType,
            interestPaymentFrequency: dto.interestPaymentFrequency ?? null,
            expectedInterest: grossInterest,
            effectiveTaxRate: DEFAULT_WHT_RATE,
            netInterestAfterTax: netInterest,
            upfrontInterestPaid: dto.interestPaymentType === InterestPaymentType.UPFRONT,
            maturityInstruction: dto.maturityInstruction,
            rolloverTargetAccountId: dto.rolloverTargetAccountId ?? null,
            status: FdStatus.ACTIVE,
          },
        });

        // GL: DEBIT source account control, CREDIT FD_CONTROL
        const sourceControlCode = this.glService.getGlControlAccount(sourceAccount.accountType);
        await this.postingEngine.post({
          reference,
          category: TransactionCategory.FD_OPENING,
          narration: `FD opening - Account ${accountNumber}`,
          initiatedBy: userId,
          entries: [
            {
              glCode: sourceControlCode,
              entryType: 'DEBIT',
              amount: principal,
              narration: 'FD funding debit',
            },
            {
              glCode: 'FIXED_DEPOSIT_CONTROL',
              entryType: 'CREDIT',
              amount: principal,
              narration: 'FD liability credit',
            },
          ],
        });

        // d. UPFRONT interest payment
        if (dto.interestPaymentType === InterestPaymentType.UPFRONT) {
          // Debit FD_INTEREST_EXP, credit WHT_PAYABLE + source account net
          const upfrontRef = `FD-INT-UPFRONT-${fd.id}`;
          await this.postingEngine.post({
            reference: upfrontRef,
            category: TransactionCategory.FD_INTEREST,
            narration: `Upfront interest payment for FD ${fd.id}`,
            initiatedBy: userId,
            entries: [
              {
                glCode: 'FD_INTEREST_EXPENSE',
                entryType: 'DEBIT',
                amount: grossInterest,
                narration: 'Gross FD interest expense',
              },
              {
                glCode: 'WHT_PAYABLE',
                entryType: 'CREDIT',
                amount: whtAmount,
                narration: 'WHT on FD interest',
              },
              {
                glCode: sourceControlCode,
                entryType: 'CREDIT',
                amount: netInterest,
                narration: 'Net upfront interest to source account',
              },
            ],
          });

          // Credit source account with net interest
          await tx.account.update({
            where: { id: dto.sourceAccountId },
            data: {
              currentBalance: { increment: netInterest.toNumber() },
              availableBalance: { increment: netInterest.toNumber() },
              ledgerBalance: { increment: netInterest.toNumber() },
            },
          });

          // Record as interest payment
          await tx.fdInterestPayment.create({
            data: {
              tenantId,
              fdId: fd.id,
              scheduledDate: startDate,
              grossAmount: grossInterest,
              taxAmount: whtAmount,
              netAmount: netInterest,
              isPaid: true,
              paidAt: startDate,
            },
          });
        }

        // e. PERIODIC: create schedule
        if (
          dto.interestPaymentType === InterestPaymentType.PERIODIC &&
          dto.interestPaymentFrequency
        ) {
          const paymentDates = buildPeriodicDates(
            startDate,
            dto.tenorDays,
            dto.interestPaymentFrequency,
          );
          // Distribute total interest evenly across periods (last gets remainder)
          const numPeriods = paymentDates.length;
          const grossPerPeriod = grossInterest.dividedBy(numPeriods).toDecimalPlaces(4);
          const whtPerPeriod = grossPerPeriod.times(DEFAULT_WHT_RATE).toDecimalPlaces(4);
          const netPerPeriod = grossPerPeriod.minus(whtPerPeriod);

          await tx.fdInterestPayment.createMany({
            data: paymentDates.map((scheduledDate) => ({
              tenantId,
              fdId: fd.id,
              scheduledDate,
              grossAmount: grossPerPeriod,
              taxAmount: whtPerPeriod,
              netAmount: netPerPeriod,
              isPaid: false,
            })),
          });
        }

        return { ...fd, account: fdAccount };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async liquidate(
    fdId: string,
    dto: LiquidateFdDto,
    processedBy: string,
  ): Promise<FixedDepositDetails> {
    const { tenantId } = this.ctx;

    const fd = await this.prisma.fixedDepositDetails.findFirst({
      where: { id: fdId, tenantId },
      include: { account: true },
    });
    if (!fd) {
      throw new NotFoundException(`FD ${fdId} not found`);
    }
    if (fd.status !== FdStatus.ACTIVE) {
      throw new BadRequestException(
        `FD is not active (current status: ${fd.status})`,
      );
    }

    const today = new Date();
    const daysHeld = diffDays(fd.startDate, today);

    // Rule 5: Same-day liquidation blocked
    if (daysHeld < 1) {
      throw new BadRequestException('Same-day liquidation is not allowed');
    }

    const principal = new Decimal(fd.principal);
    const negotiatedRate = new Decimal(fd.negotiatedRate);
    const isEarly = daysHeld < fd.tenorDays;

    // Earned interest based on days held
    const earnedInterest = principal
      .times(negotiatedRate)
      .times(daysHeld)
      .dividedBy(365)
      .toDecimalPlaces(4);

    // Penalty calculation
    let penaltyAmount = new Decimal(0);
    if (isEarly) {
      if (fd.upfrontInterestPaid) {
        // Claw back un-earned portion
        const upfrontPaid = new Decimal(fd.expectedInterest).minus(
          new Decimal(fd.netInterestAfterTax), // netInterestAfterTax = expectedInterest - WHT
        );
        // Actually upfront amount paid = netInterestAfterTax
        // Penalty = upfrontInterestPaid (gross) - earnedInterest
        const grossUpfrontPaid = new Decimal(fd.expectedInterest);
        penaltyAmount = grossUpfrontPaid.minus(earnedInterest).toDecimalPlaces(4);
        if (penaltyAmount.lessThan(0)) penaltyAmount = new Decimal(0);
      } else {
        // 50% of earned interest
        penaltyAmount = earnedInterest.dividedBy(2).toDecimalPlaces(4);
      }
    }

    const whtOnEarned = earnedInterest.times(DEFAULT_WHT_RATE).toDecimalPlaces(4);
    const netAmount = principal
      .plus(earnedInterest)
      .minus(whtOnEarned)
      .minus(penaltyAmount)
      .toDecimalPlaces(4);

    const liquidationRef = `FD-LIQ-${fd.id}-${Date.now()}`;

    const sourceControlCode = this.glService.getGlControlAccount(
      // Source account type — look it up
      AccountType.SAVINGS, // default; we'll get the actual type below
    );

    // Get source account type for GL mapping
    const sourceAccount = await this.prisma.account.findFirst({
      where: { id: fd.sourceAccountId, tenantId },
    });
    const srcControlCode = sourceAccount
      ? this.glService.getGlControlAccount(sourceAccount.accountType)
      : 'SAVINGS_CONTROL';

    return this.prisma.$transaction(
      async (tx) => {
        // Credit source account with netAmount
        if (sourceAccount) {
          await tx.account.update({
            where: { id: fd.sourceAccountId },
            data: {
              currentBalance: { increment: netAmount.toNumber() },
              availableBalance: { increment: netAmount.toNumber() },
              ledgerBalance: { increment: netAmount.toNumber() },
            },
          });
        }

        // Zero out FD account balance
        await tx.account.update({
          where: { id: fd.accountId },
          data: {
            currentBalance: 0,
            availableBalance: 0,
            ledgerBalance: 0,
            status: AccountStatus.CLOSED,
            closedAt: today,
            closedBy: processedBy,
            closureReason: `FD Liquidation: ${dto.reason}`,
          },
        });

        // GL postings for liquidation
        // Return principal: DEBIT FD_CONTROL, CREDIT source control
        // Interest expense: DEBIT FD_INTEREST_EXPENSE, CREDIT WHT_PAYABLE + source control
        // Penalty income: DEBIT source control (or reduce credit), CREDIT FD_PENALTY_INCOME
        const glEntries: Array<{
          glCode: string;
          entryType: 'DEBIT' | 'CREDIT';
          amount: Decimal;
          narration?: string;
        }> = [];

        // Principal return
        glEntries.push(
          { glCode: 'FIXED_DEPOSIT_CONTROL', entryType: 'DEBIT', amount: principal, narration: 'FD principal return' },
          { glCode: srcControlCode, entryType: 'CREDIT', amount: principal, narration: 'Principal to source account' },
        );

        // Net interest credited to customer (if any)
        const netInterestToCustomer = earnedInterest.minus(whtOnEarned).minus(penaltyAmount).toDecimalPlaces(4);
        if (netInterestToCustomer.greaterThan(0)) {
          glEntries.push(
            { glCode: 'FD_INTEREST_EXPENSE', entryType: 'DEBIT', amount: netInterestToCustomer, narration: 'Net interest expense' },
            { glCode: srcControlCode, entryType: 'CREDIT', amount: netInterestToCustomer, narration: 'Interest to source account' },
          );
        }

        // WHT
        if (whtOnEarned.greaterThan(0)) {
          glEntries.push(
            { glCode: 'FD_INTEREST_EXPENSE', entryType: 'DEBIT', amount: whtOnEarned, narration: 'WHT on FD interest' },
            { glCode: 'WHT_PAYABLE', entryType: 'CREDIT', amount: whtOnEarned, narration: 'WHT payable' },
          );
        }

        // Penalty income (reduces amount paid to customer)
        if (penaltyAmount.greaterThan(0)) {
          glEntries.push(
            { glCode: 'FD_PENALTY_INCOME', entryType: 'CREDIT', amount: penaltyAmount, narration: 'Early liquidation penalty' },
            { glCode: 'FD_INTEREST_EXPENSE', entryType: 'DEBIT', amount: penaltyAmount, narration: 'Penalty offset' },
          );
        }

        await this.postingEngine.post({
          reference: liquidationRef,
          category: TransactionCategory.FD_LIQUIDATION,
          narration: `FD liquidation ${fd.id} - ${dto.reason}`,
          initiatedBy: processedBy,
          entries: glEntries,
        });

        // Create liquidation record
        await tx.fdLiquidation.create({
          data: {
            tenantId,
            fdId: fd.id,
            reason: dto.reason,
            daysHeld,
            principalReturned: principal,
            grossInterestEarned: earnedInterest,
            penaltyAmount,
            taxAmount: whtOnEarned,
            netAmountPaid: netAmount,
            liquidatedAt: today,
            processedBy,
          },
        });

        // Update FD status
        const updatedFd = await tx.fixedDepositDetails.update({
          where: { id: fd.id },
          data: { status: FdStatus.LIQUIDATED },
        });

        return updatedFd;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async getFd(accountId: string): Promise<FixedDepositDetails & { account: Account }> {
    const { tenantId } = this.ctx;
    const fd = await this.prisma.fixedDepositDetails.findFirst({
      where: { accountId, tenantId },
      include: { account: true, interestPayments: true, liquidation: true },
    });
    if (!fd) {
      throw new NotFoundException(`FD for account ${accountId} not found`);
    }
    return fd;
  }

  async listActiveFds(tenantId?: string): Promise<FixedDepositDetails[]> {
    return this.prisma.fixedDepositDetails.findMany({
      where: {
        status: FdStatus.ACTIVE,
        ...(tenantId ? { tenantId } : {}),
      },
      include: { account: true, interestPayments: true },
    });
  }
}
