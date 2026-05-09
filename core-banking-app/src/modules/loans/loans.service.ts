import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@libs/database';
import { TenantContext, NubanUtil, AmortizationUtil } from '@libs/common';
import {
  AccountStatus,
  AccountType,
  InstallmentStatus,
  LoanApplicationStatus,
  LoanClassification,
  LoanStatus,
  TransactionCategory,
} from '@prisma/client';
import { PostingEngine } from '@modules/gl/posting-engine';
import { GlService } from '@modules/gl/gl.service';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { RepayLoanDto } from './dto/repay-loan.dto';

const PENAL_RATE_PA = new Decimal('0.05');

/** Difference in whole days between two dates (floor). */
function diffDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

/** Add whole days to a date, returning a new Date. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface ClassificationResult {
  classification: LoanClassification;
  provisionRate: Decimal;
}

function classifyByDpd(dpd: number): ClassificationResult {
  if (dpd < 90) return { classification: LoanClassification.PERFORMING, provisionRate: new Decimal('0.01') };
  if (dpd < 180) return { classification: LoanClassification.WATCH, provisionRate: new Decimal('0.05') };
  if (dpd < 270) return { classification: LoanClassification.SUBSTANDARD, provisionRate: new Decimal('0.25') };
  if (dpd < 360) return { classification: LoanClassification.DOUBTFUL, provisionRate: new Decimal('0.50') };
  return { classification: LoanClassification.LOST, provisionRate: new Decimal('1.00') };
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly postingEngine: PostingEngine,
    private readonly glService: GlService,
  ) {}

  // ─── Apply ────────────────────────────────────────────────────────────────

  async apply(dto: ApplyLoanDto) {
    const { tenantId } = this.ctx;
    const year = new Date().getFullYear();

    const count = await this.prisma.loanApplication.count({ where: { tenantId } });
    const applicationRef = `LA-${year}-${String(count + 1).padStart(6, '0')}`;

    return this.prisma.loanApplication.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        productId: dto.productId,
        applicationRef,
        requestedAmount: new Decimal(dto.requestedAmount),
        tenorDays: dto.tenorDays,
        repaymentMethod: dto.repaymentMethod,
        repaymentFrequency: dto.repaymentFrequency,
        purpose: dto.purpose ?? null,
      },
    });
  }

  // ─── Approve ──────────────────────────────────────────────────────────────

  async approve(applicationId: string, dto: ApproveLoanDto, reviewerId: string) {
    const { tenantId } = this.ctx;

    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, tenantId },
    });
    if (!application) {
      throw new NotFoundException(`Loan application ${applicationId} not found`);
    }
    if (application.status !== LoanApplicationStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Application is not in PENDING_REVIEW status (current: ${application.status})`,
      );
    }

    return this.prisma.loanApplication.update({
      where: { id: applicationId },
      data: {
        approvedAmount: new Decimal(dto.approvedAmount),
        approvedRate: new Decimal(dto.approvedRate),
        approvedTenor: dto.approvedTenor ?? null,
        status: LoanApplicationStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  // ─── Decline ──────────────────────────────────────────────────────────────

  async decline(applicationId: string, reason: string, reviewerId: string) {
    const { tenantId } = this.ctx;

    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, tenantId },
    });
    if (!application) {
      throw new NotFoundException(`Loan application ${applicationId} not found`);
    }
    if (application.status !== LoanApplicationStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Application is not in PENDING_REVIEW status (current: ${application.status})`,
      );
    }

    return this.prisma.loanApplication.update({
      where: { id: applicationId },
      data: {
        status: LoanApplicationStatus.DECLINED,
        declineReason: reason,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  // ─── Disburse ─────────────────────────────────────────────────────────────

  async disburse(applicationId: string, dto: DisburseLoanDto, disbursedBy: string) {
    const { tenantId } = this.ctx;

    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, tenantId },
    });
    if (!application) {
      throw new NotFoundException(`Loan application ${applicationId} not found`);
    }
    if (application.status !== LoanApplicationStatus.APPROVED) {
      throw new BadRequestException(
        `Application is not in APPROVED status (current: ${application.status})`,
      );
    }

    if (!application.approvedAmount || !application.approvedRate) {
      throw new BadRequestException('Application is missing approved amount or rate');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: application.productId, tenantId },
    });

    const org = await this.prisma.organisation.findUnique({ where: { id: tenantId } });
    if (!org || !org.sortCode) {
      throw new BadRequestException('Organisation sort code not configured');
    }

    const count = await this.prisma.account.count({ where: { tenantId } });
    const accountNumber = NubanUtil.generate(org.sortCode, count + 1);

    const approvedRate = new Decimal(application.approvedRate.toString());
    const principal = new Decimal(application.approvedAmount.toString());
    const tenorDays = application.approvedTenor ?? application.tenorDays;
    const startDate = new Date();
    const expectedEndDate = addDays(startDate, tenorDays);

    const periodsPerYear = AmortizationUtil.periodsPerYear(
      product?.accrualFrequency ?? 'MONTHLY',
    );

    const schedule = AmortizationUtil.buildSchedule({
      principal,
      annualRate: approvedRate,
      tenorDays,
      startDate,
      method: application.repaymentMethod as any,
      periodsPerYear,
    });

    const reference = `LOAN-DISB-${applicationId}-${Date.now()}`;

    return this.prisma.$transaction(
      async (tx) => {
        // a. Create loan account (of type CURRENT for loan portfolio)
        const account = await tx.account.create({
          data: {
            tenantId,
            customerId: application.customerId,
            productId: application.productId,
            branchId: this.ctx.branchId,
            accountNumber,
            accountType: AccountType.CURRENT,
            status: AccountStatus.ACTIVE,
            currentBalance: principal,
            availableBalance: principal,
            ledgerBalance: principal,
          },
        });

        // b. Create LoanAccount
        const loanAccount = await tx.loanAccount.create({
          data: {
            tenantId,
            accountId: account.id,
            applicationId,
            customerId: application.customerId,
            principalAmount: principal,
            interestRate: approvedRate,
            tenorDays,
            repaymentMethod: application.repaymentMethod,
            repaymentFrequency: application.repaymentFrequency,
            startDate,
            expectedEndDate,
            disbursementDate: startDate,
            outstandingPrincipal: principal,
            outstandingInterest: new Decimal(0),
            outstandingPenalty: new Decimal(0),
            accruedInterest: new Decimal(0),
            accruedPenalty: new Decimal(0),
            totalRepaid: new Decimal(0),
            classification: LoanClassification.PERFORMING,
            daysPastDue: 0,
            provisionRate: new Decimal('0.01'),
            provisionAmount: principal.times(new Decimal('0.01')),
            status: LoanStatus.ACTIVE,
          },
        });

        // c. Create repayment schedule
        await tx.repaymentSchedule.createMany({
          data: schedule.map((row) => ({
            tenantId,
            loanAccountId: loanAccount.id,
            installmentNo: row.no,
            dueDate: row.dueDate,
            principalDue: row.principal,
            interestDue: row.interest,
            totalDue: row.total,
            principalPaid: new Decimal(0),
            interestPaid: new Decimal(0),
            penaltyPaid: new Decimal(0),
            status: InstallmentStatus.PENDING,
          })),
        });

        // d. GL: DEBIT LOAN_PORTFOLIO, CREDIT SAVINGS_CONTROL (to target account)
        await this.postingEngine.post({
          reference,
          category: TransactionCategory.LOAN_DISBURSEMENT,
          narration: `Loan disbursement for application ${applicationId}`,
          initiatedBy: disbursedBy,
          entries: [
            {
              glCode: 'LOAN_PORTFOLIO',
              entryType: 'DEBIT',
              amount: principal,
              narration: 'Loan portfolio debit',
            },
            {
              glCode: 'SAVINGS_CONTROL',
              entryType: 'CREDIT',
              amount: principal,
              narration: 'Credit to borrower account',
            },
          ],
        });

        // e. Update target account balance
        await tx.account.update({
          where: { id: dto.targetAccountId },
          data: {
            currentBalance: { increment: principal },
            availableBalance: { increment: principal },
            ledgerBalance: { increment: principal },
          },
        });

        // f. Create LoanDisbursement record
        await tx.loanDisbursement.create({
          data: {
            tenantId,
            loanAccountId: loanAccount.id,
            amount: principal,
            mode: dto.mode,
            targetAccountId: dto.targetAccountId,
            transactionId: null,
            disbursedAt: startDate,
            disbursedBy,
          },
        });

        // g. Update application status to DISBURSED
        await tx.loanApplication.update({
          where: { id: applicationId },
          data: { status: LoanApplicationStatus.DISBURSED },
        });

        return loanAccount;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  // ─── Repay ────────────────────────────────────────────────────────────────

  async repay(loanAccountId: string, dto: RepayLoanDto) {
    const { tenantId } = this.ctx;

    const loanAccount = await this.prisma.loanAccount.findFirst({
      where: { id: loanAccountId, tenantId },
    });
    if (!loanAccount) {
      throw new NotFoundException(`Loan account ${loanAccountId} not found`);
    }
    if (loanAccount.status === LoanStatus.CLOSED || loanAccount.status === LoanStatus.WRITTEN_OFF) {
      throw new BadRequestException(`Loan account is ${loanAccount.status}`);
    }

    // ── WATERFALL — NEVER change this order ──────────────────────────────────
    const amount = new Decimal(dto.amount);
    let remaining = amount;

    const outstandingPenalty = new Decimal(loanAccount.outstandingPenalty.toString());
    const outstandingInterest = new Decimal(loanAccount.outstandingInterest.toString());
    const outstandingPrincipal = new Decimal(loanAccount.outstandingPrincipal.toString());

    const penaltyApplied = Decimal.min(remaining, outstandingPenalty);
    remaining = remaining.minus(penaltyApplied);

    const interestApplied = Decimal.min(remaining, outstandingInterest);
    remaining = remaining.minus(interestApplied);

    const principalApplied = Decimal.min(remaining, outstandingPrincipal);
    remaining = remaining.minus(principalApplied);

    const excessReturned = remaining;
    // ─────────────────────────────────────────────────────────────────────────

    const newOutstandingPrincipal = outstandingPrincipal.minus(principalApplied);
    const isClosed = newOutstandingPrincipal.isZero();

    return this.prisma.$transaction(
      async (tx) => {
        // Update loan account balances
        await tx.loanAccount.update({
          where: { id: loanAccountId },
          data: {
            outstandingPrincipal: { decrement: principalApplied },
            outstandingInterest: { decrement: interestApplied },
            outstandingPenalty: { decrement: penaltyApplied },
            totalRepaid: { increment: amount.minus(excessReturned) },
            status: isClosed ? LoanStatus.CLOSED : undefined,
          },
        });

        // GL entries
        const glEntries: Array<{
          glCode: string;
          entryType: 'DEBIT' | 'CREDIT';
          amount: Decimal;
          narration?: string;
        }> = [
          {
            glCode: 'SAVINGS_CONTROL',
            entryType: 'DEBIT',
            amount: amount.minus(excessReturned),
            narration: 'Loan repayment receipt',
          },
        ];

        if (penaltyApplied.greaterThan(0)) {
          glEntries.push({
            glCode: 'PENALTY_INCOME',
            entryType: 'CREDIT',
            amount: penaltyApplied,
            narration: 'Penalty income',
          });
        }
        if (interestApplied.greaterThan(0)) {
          glEntries.push({
            glCode: 'INTEREST_INCOME',
            entryType: 'CREDIT',
            amount: interestApplied,
            narration: 'Interest income',
          });
        }
        if (principalApplied.greaterThan(0)) {
          glEntries.push({
            glCode: 'LOAN_PORTFOLIO',
            entryType: 'CREDIT',
            amount: principalApplied,
            narration: 'Principal repayment',
          });
        }

        const reference = `LOAN-REPAY-${loanAccountId}-${Date.now()}`;
        const txRecord = await this.postingEngine.post({
          reference,
          category: TransactionCategory.LOAN_REPAYMENT,
          narration: `Loan repayment for account ${loanAccountId}`,
          initiatedBy: this.ctx.userId,
          entries: glEntries,
        });

        // Return excess if applicable
        if (excessReturned.greaterThan(0)) {
          // Look up the associated account via loan account → source account
          const account = await tx.account.findUnique({
            where: { id: loanAccount.accountId },
          });

          if (account) {
            // Find debtor's savings/current account (source of repayment)
            // Credit the excess back to the loan's linked account
            await tx.account.update({
              where: { id: account.id },
              data: {
                currentBalance: { increment: excessReturned },
                availableBalance: { increment: excessReturned },
              },
            });

            await this.postingEngine.post({
              reference: `${reference}-EXCESS`,
              category: TransactionCategory.LOAN_REPAYMENT,
              narration: `Excess repayment returned for loan ${loanAccountId}`,
              entries: [
                {
                  glCode: 'SAVINGS_CONTROL',
                  entryType: 'DEBIT',
                  amount: excessReturned,
                  narration: 'Excess repayment debit',
                },
                {
                  glCode: 'CURRENT_CONTROL',
                  entryType: 'CREDIT',
                  amount: excessReturned,
                  narration: 'Excess returned to account',
                },
              ],
            });
          }
        }

        // Update repayment schedule — mark installments PAID in order of dueDate
        const scheduleRows = await tx.repaymentSchedule.findMany({
          where: {
            loanAccountId,
            status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIALLY_PAID, InstallmentStatus.OVERDUE] },
          },
          orderBy: { dueDate: 'asc' },
        });

        let principalRemaining = principalApplied;
        let interestRemaining = interestApplied;

        for (const row of scheduleRows) {
          if (principalRemaining.isZero() && interestRemaining.isZero()) break;

          const rowPrincipalOwed = new Decimal(row.principalDue.toString()).minus(new Decimal(row.principalPaid.toString()));
          const rowInterestOwed = new Decimal(row.interestDue.toString()).minus(new Decimal(row.interestPaid.toString()));

          const pPaid = Decimal.min(principalRemaining, rowPrincipalOwed);
          const iPaid = Decimal.min(interestRemaining, rowInterestOwed);

          principalRemaining = principalRemaining.minus(pPaid);
          interestRemaining = interestRemaining.minus(iPaid);

          const newPrincipalPaid = new Decimal(row.principalPaid.toString()).plus(pPaid);
          const newInterestPaid = new Decimal(row.interestPaid.toString()).plus(iPaid);

          const fullyPaid =
            newPrincipalPaid.greaterThanOrEqualTo(new Decimal(row.principalDue.toString())) &&
            newInterestPaid.greaterThanOrEqualTo(new Decimal(row.interestDue.toString()));

          await tx.repaymentSchedule.update({
            where: { id: row.id },
            data: {
              principalPaid: newPrincipalPaid,
              interestPaid: newInterestPaid,
              status: fullyPaid ? InstallmentStatus.PAID : InstallmentStatus.PARTIALLY_PAID,
              paidAt: fullyPaid ? new Date() : null,
            },
          });
        }

        // Create LoanRepayment record
        await tx.loanRepayment.create({
          data: {
            tenantId,
            loanAccountId,
            amount,
            penaltyApplied,
            interestApplied,
            principalApplied,
            excessReturned,
            transactionId: txRecord.id,
            channel: dto.channel ?? null,
          },
        });

        return { loanAccountId, amount, penaltyApplied, interestApplied, principalApplied, excessReturned, isClosed };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  // ─── Classify ─────────────────────────────────────────────────────────────

  async classifyLoan(loanAccountId: string) {
    const { tenantId } = this.ctx;

    const loanAccount = await this.prisma.loanAccount.findFirst({
      where: { id: loanAccountId, tenantId },
    });
    if (!loanAccount) {
      throw new NotFoundException(`Loan account ${loanAccountId} not found`);
    }

    const today = new Date();

    // Find oldest unpaid or overdue installment past due date
    const oldestUnpaid = await this.prisma.repaymentSchedule.findFirst({
      where: {
        loanAccountId,
        status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIALLY_PAID, InstallmentStatus.OVERDUE] },
        dueDate: { lt: today },
      },
      orderBy: { dueDate: 'asc' },
    });

    const dpd = oldestUnpaid ? diffDays(oldestUnpaid.dueDate, today) : 0;
    const { classification, provisionRate } = classifyByDpd(dpd);

    const outstandingPrincipal = new Decimal(loanAccount.outstandingPrincipal.toString());
    const newProvisionAmount = outstandingPrincipal.times(provisionRate).toDecimalPlaces(4);
    const oldProvisionAmount = new Decimal(loanAccount.provisionAmount.toString());

    const classificationChanged = loanAccount.classification !== classification;

    if (classificationChanged) {
      await this.prisma.loanClassificationHistory.create({
        data: {
          tenantId,
          loanAccountId,
          fromClass: loanAccount.classification,
          toClass: classification,
          daysPastDue: dpd,
          provisionRate,
          provisionAmount: newProvisionAmount,
        },
      });
    }

    // Post GL for any provision change
    if (!newProvisionAmount.equals(oldProvisionAmount)) {
      const reference = `LOAN-PROV-${loanAccountId}-${Date.now()}`;

      if (newProvisionAmount.greaterThan(oldProvisionAmount)) {
        const increase = newProvisionAmount.minus(oldProvisionAmount);
        await this.postingEngine.post({
          reference,
          category: TransactionCategory.ADJUSTMENT,
          narration: `Provision increase for loan ${loanAccountId} (DPD: ${dpd})`,
          entries: [
            { glCode: 'PROVISION_EXPENSE', entryType: 'DEBIT', amount: increase, narration: 'Loan loss provision expense' },
            { glCode: 'LOAN_LOSS_PROVISION', entryType: 'CREDIT', amount: increase, narration: 'Loan loss provision credit' },
          ],
        });
      } else {
        const decrease = oldProvisionAmount.minus(newProvisionAmount);
        await this.postingEngine.post({
          reference,
          category: TransactionCategory.ADJUSTMENT,
          narration: `Provision reversal for loan ${loanAccountId} (classification improved, DPD: ${dpd})`,
          entries: [
            { glCode: 'LOAN_LOSS_PROVISION', entryType: 'DEBIT', amount: decrease, narration: 'Provision reversal' },
            { glCode: 'PROVISION_EXPENSE', entryType: 'CREDIT', amount: decrease, narration: 'Provision expense reversal' },
          ],
        });
      }
    }

    // Mark overdue installments
    if (dpd > 0) {
      await this.prisma.repaymentSchedule.updateMany({
        where: {
          loanAccountId,
          status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIALLY_PAID] },
          dueDate: { lt: today },
        },
        data: { status: InstallmentStatus.OVERDUE },
      });
    }

    return this.prisma.loanAccount.update({
      where: { id: loanAccountId },
      data: {
        classification,
        daysPastDue: dpd,
        provisionRate,
        provisionAmount: newProvisionAmount,
        status: dpd > 0 && loanAccount.status === LoanStatus.ACTIVE ? LoanStatus.OVERDUE : undefined,
      },
    });
  }

  // ─── Accrue Overdue Penalty ───────────────────────────────────────────────

  async accrueOverduePenalty(loanAccountId: string, asOfDate?: Date) {
    const { tenantId } = this.ctx;
    const today = asOfDate ?? new Date();
    // Normalize to midnight for idempotency comparison
    const todayKey = today.toISOString().slice(0, 10);

    const loanAccount = await this.prisma.loanAccount.findFirst({
      where: { id: loanAccountId, tenantId },
    });
    if (!loanAccount) {
      throw new NotFoundException(`Loan account ${loanAccountId} not found`);
    }

    if (loanAccount.daysPastDue <= 0) {
      return loanAccount;
    }

    // Idempotency guard: skip if penalty was already accrued today
    if (loanAccount.lastPenaltyAccrualDate) {
      const lastKey = loanAccount.lastPenaltyAccrualDate.toISOString().slice(0, 10);
      if (lastKey >= todayKey) {
        return loanAccount;
      }
    }

    const outstandingPrincipal = new Decimal(loanAccount.outstandingPrincipal.toString());
    const interestRate = new Decimal(loanAccount.interestRate.toString());
    const effectiveRate = interestRate.plus(PENAL_RATE_PA);

    const dailyPenalty = outstandingPrincipal
      .times(effectiveRate)
      .dividedBy(365)
      .toDecimalPlaces(4);

    return this.prisma.loanAccount.update({
      where: { id: loanAccountId },
      data: {
        accruedPenalty: { increment: dailyPenalty },
        outstandingPenalty: { increment: dailyPenalty },
        lastPenaltyAccrualDate: today,
      },
    });
  }

  // ─── Write Off ────────────────────────────────────────────────────────────

  async writeOff(loanAccountId: string, writtenOffBy: string) {
    const { tenantId } = this.ctx;

    const loanAccount = await this.prisma.loanAccount.findFirst({
      where: { id: loanAccountId, tenantId },
    });
    if (!loanAccount) {
      throw new NotFoundException(`Loan account ${loanAccountId} not found`);
    }
    if (loanAccount.classification !== LoanClassification.LOST) {
      throw new BadRequestException(
        `Loan can only be written off when classification is LOST (current: ${loanAccount.classification})`,
      );
    }

    const outstandingPrincipal = new Decimal(loanAccount.outstandingPrincipal.toString());
    const provisionAmount = new Decimal(loanAccount.provisionAmount.toString());
    // Unprovisioned residual goes to BAD_DEBT_EXPENSE (normally zero for LOST loans)
    const unprovisioned = Decimal.max(outstandingPrincipal.minus(provisionAmount), new Decimal(0));
    const reference = `LOAN-WRITEOFF-${loanAccountId}-${Date.now()}`;

    return this.prisma.$transaction(
      async (tx) => {
        // Build entries: clear LOAN_PORTFOLIO, reverse LOAN_LOSS_PROVISION, expense any residual
        const entries: Array<{ glCode: string; entryType: 'DEBIT' | 'CREDIT'; amount: Decimal; narration?: string }> = [];

        // Reverse accumulated provision (LOAN_LOSS_PROVISION has CREDIT normal balance — debit to clear it)
        if (provisionAmount.gt(0)) {
          entries.push({
            glCode: 'LOAN_LOSS_PROVISION',
            entryType: 'DEBIT',
            amount: provisionAmount,
            narration: 'Provision reversal on write-off',
          });
        }

        // Any unprovisioned balance goes to expense
        if (unprovisioned.gt(0)) {
          entries.push({
            glCode: 'BAD_DEBT_EXPENSE',
            entryType: 'DEBIT',
            amount: unprovisioned,
            narration: 'Unprovisioned bad debt expense',
          });
        }

        // Close the loan asset
        entries.push({
          glCode: 'LOAN_PORTFOLIO',
          entryType: 'CREDIT',
          amount: outstandingPrincipal,
          narration: 'Loan portfolio write-off',
        });

        await this.postingEngine.post({
          reference,
          category: TransactionCategory.ADJUSTMENT,
          narration: `Write-off for loan account ${loanAccountId}`,
          initiatedBy: writtenOffBy,
          entries,
        });

        return tx.loanAccount.update({
          where: { id: loanAccountId },
          data: {
            status: LoanStatus.WRITTEN_OFF,
            writtenOffAt: new Date(),
            writtenOffBy,
            writeOffAmount: outstandingPrincipal,
            provisionAmount: new Decimal(0),
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findAll(customerId?: string) {
    const { tenantId } = this.ctx;
    return this.prisma.loanApplication.findMany({
      where: {
        tenantId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const { tenantId } = this.ctx;
    const application = await this.prisma.loanApplication.findFirst({
      where: { id, tenantId },
      include: { loanAccount: true, collaterals: true, fees: true },
    });
    if (!application) {
      throw new NotFoundException(`Loan application ${id} not found`);
    }
    return application;
  }

  async getSchedule(loanAccountId: string) {
    const { tenantId } = this.ctx;
    const loanAccount = await this.prisma.loanAccount.findFirst({
      where: { id: loanAccountId, tenantId },
      include: {
        repaymentSchedule: { orderBy: { installmentNo: 'asc' } },
        account: { select: { accountNumber: true, currencyCode: true } },
      },
    });
    if (!loanAccount) {
      throw new NotFoundException(`Loan account ${loanAccountId} not found`);
    }
    return {
      loanAccountId: loanAccount.id,
      accountNumber: loanAccount.account.accountNumber,
      currencyCode: loanAccount.account.currencyCode,
      schedule: loanAccount.repaymentSchedule.map((row) => ({
        installmentNo: row.installmentNo,
        dueDate: row.dueDate,
        principalDue: new Decimal(row.principalDue.toString()).toFixed(4),
        interestDue: new Decimal(row.interestDue.toString()).toFixed(4),
        totalDue: new Decimal(row.totalDue.toString()).toFixed(4),
        principalPaid: new Decimal(row.principalPaid.toString()).toFixed(4),
        interestPaid: new Decimal(row.interestPaid.toString()).toFixed(4),
        penaltyPaid: new Decimal(row.penaltyPaid.toString()).toFixed(4),
        status: row.status,
        paidAt: row.paidAt,
      })),
    };
  }
}
