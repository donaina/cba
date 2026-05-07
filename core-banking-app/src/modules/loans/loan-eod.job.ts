import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { LoansService } from './loans.service';
import { LoanStatus } from '@prisma/client';

@Injectable()
export class LoanEodJob {
  private readonly logger = new Logger(LoanEodJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loansService: LoansService,
    private readonly ctx: TenantContext,
  ) {}

  @Cron('0 22 * * *', { timeZone: 'Africa/Lagos' })
  async runLoanEodJob(): Promise<void> {
    this.logger.log('Loan EOD Job started');

    // Get all active organisations
    const orgs = await this.prisma.organisation.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    this.logger.log(`Processing EOD for ${orgs.length} organisations`);

    for (const org of orgs) {
      // Populate context so service methods filter correctly
      this.ctx.tenantId = org.id;
      this.ctx.userId = 'SYSTEM';
      this.ctx.branchId = 'SYSTEM';
      this.ctx.sessionId = 'EOD';

      const loanAccounts = await this.prisma.loanAccount.findMany({
        where: {
          tenantId: org.id,
          status: { in: [LoanStatus.ACTIVE, LoanStatus.OVERDUE] },
        },
        select: { id: true },
      });

      this.logger.log(
        `Organisation ${org.id}: processing ${loanAccounts.length} loan accounts`,
      );

      for (const loanAccount of loanAccounts) {
        try {
          await this.loansService.accrueOverduePenalty(loanAccount.id);
        } catch (err) {
          this.logger.error(
            `Failed to accrue penalty for loan ${loanAccount.id}: ${err}`,
          );
        }

        try {
          await this.loansService.classifyLoan(loanAccount.id);
        } catch (err) {
          this.logger.error(
            `Failed to classify loan ${loanAccount.id}: ${err}`,
          );
        }
      }
    }

    this.logger.log('Loan EOD Job completed');
  }
}
