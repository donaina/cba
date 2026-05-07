import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { EntryType } from '@prisma/client';
import { StatementPdfService, StatementData, StatementLine } from './statement-pdf.service';
import { StatementQueryDto } from './dto/statement-query.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { LoanPortfolioQueryDto } from './dto/loan-portfolio-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly statementPdfService: StatementPdfService,
  ) {}

  async getStatement(dto: StatementQueryDto): Promise<StatementData> {
    const { tenantId } = this.ctx;

    const account = await this.prisma.account.findUnique({
      where: { tenantId_accountNumber: { tenantId, accountNumber: dto.accountNumber } },
      include: { customer: true, product: true },
    });

    if (!account) {
      throw new NotFoundException(`Account ${dto.accountNumber} not found`);
    }

    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from ? new Date(dto.from) : new Date(account.createdAt);
    to.setHours(23, 59, 59, 999);

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const skip = (page - 1) * limit;

    // Filter by accountId — entries stamped with this customer account's ID only
    const entries = await this.prisma.transactionEntry.findMany({
      where: {
        tenantId,
        accountId: account.id,
        createdAt: { gte: from, lte: to },
      },
      include: { transaction: true },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });

    const openingEntries = await this.prisma.transactionEntry.findMany({
      where: {
        tenantId,
        accountId: account.id,
        createdAt: { lt: from },
      },
      select: { entryType: true, amount: true },
    });

    let openingBalance = new Decimal(0);
    for (const e of openingEntries) {
      const amount = new Decimal(e.amount.toString());
      if (e.entryType === EntryType.CREDIT) {
        openingBalance = openingBalance.plus(amount);
      } else {
        openingBalance = openingBalance.minus(amount);
      }
    }

    let runningBalance = openingBalance;
    const lines: StatementLine[] = entries.map((e) => {
      const amount = new Decimal(e.amount.toString());
      const isCredit = e.entryType === EntryType.CREDIT;
      if (isCredit) {
        runningBalance = runningBalance.plus(amount);
      } else {
        runningBalance = runningBalance.minus(amount);
      }
      return {
        date: e.createdAt,
        description: e.narration ?? e.transaction.narration ?? e.transaction.reference,
        debit: isCredit ? null : amount,
        credit: isCredit ? amount : null,
        balance: runningBalance,
      };
    });

    const accountHolder = account.customer.customerType === 'CORPORATE'
      ? (account.customer.companyName ?? '')
      : [account.customer.firstName, account.customer.lastName].filter(Boolean).join(' ');

    return {
      accountNumber: account.accountNumber,
      accountHolder,
      currency: account.currencyCode,
      from,
      to,
      openingBalance,
      closingBalance: runningBalance,
      lines,
    };
  }

  async getStatementPdf(dto: StatementQueryDto): Promise<Buffer> {
    const { tenantId } = this.ctx;
    const data = await this.getStatement(dto);
    return this.statementPdfService.generate(tenantId, data);
  }

  async getTrialBalance(dto: TrialBalanceQueryDto): Promise<object> {
    const { tenantId } = this.ctx;
    const asAt = new Date(dto.asAt);
    asAt.setHours(23, 59, 59, 999);

    const glAccounts = await this.prisma.gLAccount.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true, name: true, type: true, normalBalance: true },
    });

    const glAccountIds = glAccounts.map((a) => a.id);

    const rawEntries = await this.prisma.transactionEntry.groupBy({
      by: ['glAccountId', 'entryType'],
      where: { tenantId, glAccountId: { in: glAccountIds }, createdAt: { lte: asAt } },
      _sum: { amount: true },
    });

    const totalsMap = new Map<string, { debitTotal: Decimal; creditTotal: Decimal }>();

    for (const row of rawEntries) {
      const existing = totalsMap.get(row.glAccountId) ?? { debitTotal: new Decimal(0), creditTotal: new Decimal(0) };
      const sum = new Decimal(row._sum.amount?.toString() ?? '0');
      if (row.entryType === EntryType.DEBIT) {
        existing.debitTotal = existing.debitTotal.plus(sum);
      } else {
        existing.creditTotal = existing.creditTotal.plus(sum);
      }
      totalsMap.set(row.glAccountId, existing);
    }

    return glAccounts.map((acct) => {
      const totals = totalsMap.get(acct.id) ?? { debitTotal: new Decimal(0), creditTotal: new Decimal(0) };
      const balance = acct.normalBalance === 'DEBIT'
        ? totals.debitTotal.minus(totals.creditTotal)
        : totals.creditTotal.minus(totals.debitTotal);
      return {
        code: acct.code,
        name: acct.name,
        type: acct.type,
        debitTotal: totals.debitTotal.toFixed(4),
        creditTotal: totals.creditTotal.toFixed(4),
        balance: balance.toFixed(4),
      };
    });
  }

  async getLoanPortfolio(dto: LoanPortfolioQueryDto): Promise<object> {
    const { tenantId } = this.ctx;

    const asAt = dto.asAt ? new Date(dto.asAt) : undefined;

    const loanAccounts = await this.prisma.loanAccount.findMany({
      where: {
        tenantId,
        ...(dto.classification ? { classification: dto.classification } : {}),
        ...(asAt ? { createdAt: { lte: asAt } } : {}),
      },
      include: {
        application: {
          select: {
            applicationRef: true,
            requestedAmount: true,
            approvedAmount: true,
            approvedRate: true,
            purpose: true,
            repaymentMethod: true,
            repaymentFrequency: true,
          },
        },
        account: {
          select: { accountNumber: true, currencyCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return loanAccounts.map((la) => ({
      loanAccountId: la.id,
      accountNumber: la.account.accountNumber,
      applicationRef: la.application.applicationRef,
      currency: la.account.currencyCode,
      principalAmount: new Decimal(la.principalAmount.toString()).toFixed(4),
      outstandingPrincipal: new Decimal(la.outstandingPrincipal.toString()).toFixed(4),
      outstandingInterest: new Decimal(la.outstandingInterest.toString()).toFixed(4),
      outstandingPenalty: new Decimal(la.outstandingPenalty.toString()).toFixed(4),
      totalRepaid: new Decimal(la.totalRepaid.toString()).toFixed(4),
      classification: la.classification,
      daysPastDue: la.daysPastDue,
      provisionRate: new Decimal(la.provisionRate.toString()).toFixed(6),
      provisionAmount: new Decimal(la.provisionAmount.toString()).toFixed(4),
      status: la.status,
      repaymentMethod: la.application.repaymentMethod,
      repaymentFrequency: la.application.repaymentFrequency,
      approvedRate: la.application.approvedRate
        ? new Decimal(la.application.approvedRate.toString()).toFixed(6)
        : null,
      purpose: la.application.purpose ?? null,
      startDate: la.startDate,
      expectedEndDate: la.expectedEndDate,
    }));
  }

}
