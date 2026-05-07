import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { AmlAlertType, AmlAlertSeverity } from '@prisma/client';
import { AmlPublisher } from './aml.publisher';
import { FreezeAccountDto } from './dto/freeze-account.dto';
import { FileStrDto } from './dto/file-str.dto';

@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly amlPublisher: AmlPublisher,
  ) {}

  async freezeAccount(dto: FreezeAccountDto) {
    const tenantId = this.ctx.tenantId;

    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }

    const updatedAccount = await this.prisma.account.update({
      where: { id: dto.accountId },
      data: {
        isFrozen: true,
        frozenAt: new Date(),
        frozenNote: dto.note,
        status: 'FROZEN',
      },
    });

    await this.createAlert(
      account.customerId,
      AmlAlertType.ACCOUNT_FROZEN,
      AmlAlertSeverity.HIGH,
      `Account frozen: ${dto.note}`,
    );

    this.logger.log(`Account ${dto.accountId} frozen for tenant ${tenantId}`);
    return updatedAccount;
  }

  async unfreezeAccount(accountId: string, note: string) {
    const tenantId = this.ctx.tenantId;

    const account = await this.prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const updatedAccount = await this.prisma.account.update({
      where: { id: accountId },
      data: {
        isFrozen: false,
        unfrozenAt: new Date(),
        unfrozenNote: note,
        unfrozenBy: this.ctx.userId,
        status: 'ACTIVE',
      },
    });

    await this.createAlert(
      account.customerId,
      AmlAlertType.ACCOUNT_UNFROZEN,
      AmlAlertSeverity.MEDIUM,
      `Account unfrozen: ${note}`,
    );

    this.logger.log(`Account ${accountId} unfrozen by ${this.ctx.userId}`);
    return updatedAccount;
  }

  async createAlert(
    customerId: string,
    alertType: AmlAlertType,
    severity: AmlAlertSeverity,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    const tenantId = this.ctx.tenantId;

    return this.prisma.amlAlert.create({
      data: {
        tenantId,
        customerId,
        alertType,
        severity,
        description,
        metadata: (metadata ?? {}) as any,
        isResolved: false,
      },
    });
  }

  async resolveAlert(alertId: string, note: string) {
    const tenantId = this.ctx.tenantId;

    const alert = await this.prisma.amlAlert.findFirst({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    return this.prisma.amlAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedBy: this.ctx.userId,
        resolvedAt: new Date(),
        resolutionNote: note,
      },
    });
  }

  async fileStr(dto: FileStrDto) {
    const tenantId = this.ctx.tenantId;

    return this.prisma.suspiciousTransactionReport.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        alertId: dto.alertId,
        transactionIds: dto.transactionIds,
        narrative: dto.narrative,
        filedBy: this.ctx.userId,
        status: 'DRAFT',
      },
    });
  }

  async submitStr(strId: string) {
    const tenantId = this.ctx.tenantId;

    const str = await this.prisma.suspiciousTransactionReport.findFirst({
      where: { id: strId, tenantId },
    });

    if (!str) {
      throw new NotFoundException(`STR ${strId} not found`);
    }

    return this.prisma.suspiciousTransactionReport.update({
      where: { id: strId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }

  async listAlerts(resolved = false) {
    const tenantId = this.ctx.tenantId;

    return this.prisma.amlAlert.findMany({
      where: { tenantId, isResolved: resolved },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listStrs() {
    const tenantId = this.ctx.tenantId;

    return this.prisma.suspiciousTransactionReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
