import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@libs/database';
import { FixedDepositService } from './fixed-deposit.service';
import { FdStatus } from '@prisma/client';

@Injectable()
export class FdMaturityJob {
  private readonly logger = new Logger(FdMaturityJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fdService: FixedDepositService,
  ) {}

  @Cron('0 23 * * *', { timeZone: 'Africa/Lagos' })
  async runMaturityJob(): Promise<void> {
    this.logger.log('FD Maturity Job started');
    const today = new Date();

    const maturingFds = await this.prisma.fixedDepositDetails.findMany({
      where: {
        status: FdStatus.ACTIVE,
        maturityDate: { lte: today },
      },
      include: { account: true },
    });

    this.logger.log(`Found ${maturingFds.length} FDs to mature`);

    for (const fd of maturingFds) {
      try {
        // Idempotent guard — re-fetch status
        const fresh = await this.prisma.fixedDepositDetails.findUnique({ where: { id: fd.id } });
        if (!fresh || fresh.status !== FdStatus.ACTIVE) continue;

        await this.prisma.fixedDepositDetails.update({
          where: { id: fd.id },
          data: { status: FdStatus.MATURED },
        });

        this.logger.log(`Matured FD ${fd.id} for tenant ${fd.tenantId}`);
      } catch (err) {
        this.logger.error(`Failed to mature FD ${fd.id}: ${err}`);
      }
    }

    this.logger.log('FD Maturity Job completed');
  }
}
