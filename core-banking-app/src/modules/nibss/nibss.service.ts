import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { NibssSessionStatus, RegulatoryReportType } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { InwardCreditDto } from './dto/inward-credit.dto';
import { OutwardTransferDto } from './dto/outward-transfer.dto';

@Injectable()
export class NibssService {
  private readonly logger = new Logger(NibssService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly ctx: TenantContext,
  ) {}

  async nameEnquiry(accountNumber: string, bankCode: string): Promise<{ accountName: string; bankCode: string; accountNumber: string }> {
    if (process.env.NIBSS_SANDBOX === 'true') {
      this.logger.log(`[SANDBOX] Name enquiry for ${accountNumber} at bank ${bankCode}`);
      return { accountName: 'TEST USER', bankCode, accountNumber };
    }

    const nibssBaseUrl = process.env.NIBSS_BASE_URL;
    const response = await firstValueFrom(
      this.httpService.get(`${nibssBaseUrl}/name-enquiry`, {
        params: { accountNumber, bankCode },
        headers: {
          Authorization: `Bearer ${process.env.NIBSS_API_KEY}`,
        },
      }),
    );

    return response.data;
  }

  async processInwardCredit(dto: InwardCreditDto): Promise<{ success: boolean; sessionId: string; message: string }> {
    const tenantId = this.ctx.tenantId;

    // 1. Idempotency check
    const existing = await this.prisma.nibssSession.findUnique({
      where: { tenantId_sessionId: { tenantId, sessionId: dto.sessionId } },
    });

    if (existing && existing.status === NibssSessionStatus.COMPLETED) {
      this.logger.log(`Inward credit already processed for session ${dto.sessionId}`);
      return { success: true, sessionId: dto.sessionId, message: 'Already processed' };
    }

    // 2. Create/upsert NibssSession with PENDING status
    const nibssSession = await this.prisma.nibssSession.upsert({
      where: { tenantId_sessionId: { tenantId, sessionId: dto.sessionId } },
      create: {
        tenantId,
        sessionId: dto.sessionId,
        direction: 'INWARD',
        amount: new Decimal(dto.amount),
        beneficiaryAccount: dto.beneficiaryAccountNumber,
        senderAccount: dto.senderAccount,
        narration: dto.narration,
        status: NibssSessionStatus.PENDING,
      },
      update: {
        status: NibssSessionStatus.PENDING,
      },
    });

    // 3. Find beneficiary account
    const account = await this.prisma.account.findUnique({
      where: {
        tenantId_accountNumber: {
          tenantId,
          accountNumber: dto.beneficiaryAccountNumber,
        },
      },
    });

    if (!account) {
      // 4. Account not found — mark session FAILED
      await this.prisma.nibssSession.update({
        where: { id: nibssSession.id },
        data: { status: NibssSessionStatus.FAILED },
      });
      throw new BadRequestException(`Account ${dto.beneficiaryAccountNumber} not found`);
    }

    const amount = new Decimal(dto.amount);

    // 5 & 6. Serializable transaction: update balance + create transaction record
    await this.prisma.$transaction(
      async (tx) => {
        // Update account balance
        await tx.account.update({
          where: { id: account.id },
          data: {
            currentBalance: { increment: amount.toNumber() },
            availableBalance: { increment: amount.toNumber() },
            ledgerBalance: { increment: amount.toNumber() },
            lastTransactionAt: new Date(),
          },
        });

        // Create TransactionRecord for audit
        await tx.transactionRecord.create({
          data: {
            tenantId,
            reference: dto.sessionId,
            category: 'NIP_TRANSFER' as any,
            status: 'COMPLETED' as any,
            narration: dto.narration ?? `Inward NIP credit from ${dto.senderAccount ?? 'UNKNOWN'}`,
            channel: 'NIP',
            initiatedBy: 'NIBSS',
          },
        });

        // Update NibssSession with transactionId
        await tx.nibssSession.update({
          where: { id: nibssSession.id },
          data: {
            status: NibssSessionStatus.COMPLETED,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return { success: true, sessionId: dto.sessionId, message: 'Inward credit processed successfully' };
  }

  async processOutwardTransfer(dto: OutwardTransferDto): Promise<{ success: boolean; sessionId: string }> {
    const tenantId = this.ctx.tenantId;
    const amount = new Decimal(dto.amount);

    const session = await this.prisma.nibssSession.create({
      data: {
        tenantId,
        sessionId: dto.sessionId,
        direction: 'OUTWARD',
        amount,
        beneficiaryAccount: dto.beneficiaryAccount,
        beneficiaryBank: dto.beneficiaryBank,
        narration: dto.narration,
        status: NibssSessionStatus.PENDING,
      },
    });

    if (process.env.NIBSS_SANDBOX === 'true') {
      this.logger.log(`[SANDBOX] Outward transfer session ${dto.sessionId} for ${amount}`);
      await this.prisma.nibssSession.update({
        where: { id: session.id },
        data: { status: NibssSessionStatus.COMPLETED, nibssResponse: { sandbox: true } },
      });
      return { success: true, sessionId: dto.sessionId };
    }

    const nibssBaseUrl = process.env.NIBSS_BASE_URL;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${nibssBaseUrl}/transfer`,
          {
            sessionId: dto.sessionId,
            amount: dto.amount,
            beneficiaryAccount: dto.beneficiaryAccount,
            beneficiaryBank: dto.beneficiaryBank,
            narration: dto.narration,
          },
          { headers: { Authorization: `Bearer ${process.env.NIBSS_API_KEY}` } },
        ),
      );

      await this.prisma.nibssSession.update({
        where: { id: session.id },
        data: {
          status: NibssSessionStatus.COMPLETED,
          nibssResponse: response.data as object,
        },
      });

      return { success: true, sessionId: dto.sessionId };
    } catch (error) {
      await this.prisma.nibssSession.update({
        where: { id: session.id },
        data: {
          status: NibssSessionStatus.FAILED,
          nibssResponse: { error: (error as Error).message } as object,
        },
      });
      throw error;
    }
  }

  async fileCtr(transactionId: string, customerId: string, amount: Decimal, tenantId: string): Promise<void> {
    await this.prisma.regulatoryReport.create({
      data: {
        tenantId,
        reportType: RegulatoryReportType.CTR,
        transactionId,
        customerId,
        amount,
        narrative: `Auto CTR for txn ${transactionId} of ${amount}`,
        status: 'PENDING',
      },
    });
  }
}
