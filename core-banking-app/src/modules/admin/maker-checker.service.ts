import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { Decimal } from 'decimal.js';
import { MakerCheckerRequest } from '@prisma/client';

@Injectable()
export class MakerCheckerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async requiresApproval(
    module: string,
    action: string,
    amount: Decimal,
    channel: string,
  ): Promise<boolean> {
    const config = await this.prisma.makerCheckerConfig.findFirst({
      where: {
        tenantId: this.ctx.tenantId,
        module,
        action,
        isActive: true,
      },
    });

    if (!config) {
      return false;
    }

    const channelMatches = config.channels.includes(channel);
    if (!channelMatches) {
      return false;
    }

    if (config.requiresApprovalAbove === null) {
      return true;
    }

    const threshold = new Decimal(config.requiresApprovalAbove.toString());
    return amount.gte(threshold);
  }

  async createRequest(
    module: string,
    action: string,
    payload: object,
    transactionId?: string,
  ): Promise<MakerCheckerRequest> {
    const config = await this.prisma.makerCheckerConfig.findFirst({
      where: {
        tenantId: this.ctx.tenantId,
        module,
        action,
        isActive: true,
      },
    });

    const ttlMinutes = config?.ttlMinutes ?? 60;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    return this.prisma.makerCheckerRequest.create({
      data: {
        tenantId: this.ctx.tenantId,
        module,
        action,
        payload,
        initiatedBy: this.ctx.userId,
        status: 'PENDING_APPROVAL',
        expiresAt,
        ...(transactionId ? { transactionId } : {}),
      },
    });
  }

  async findById(requestId: string): Promise<MakerCheckerRequest> {
    const request = await this.prisma.makerCheckerRequest.findFirst({
      where: { id: requestId, tenantId: this.ctx.tenantId },
    });
    if (!request) throw new NotFoundException('Maker-checker request not found');
    return request;
  }

  async approve(
    requestId: string,
    approverId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executeCallback?: (payload: any) => Promise<any>,
  ): Promise<MakerCheckerRequest> {
    const request = await this.prisma.makerCheckerRequest.findFirst({
      where: { id: requestId, tenantId: this.ctx.tenantId },
    });

    if (!request) {
      throw new NotFoundException('Maker-checker request not found');
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    if (request.expiresAt && request.expiresAt < new Date()) {
      throw new BadRequestException('Maker-checker request has expired');
    }

    if (request.initiatedBy === approverId) {
      throw new ForbiddenException('Maker cannot be the checker');
    }

    const updated = await this.prisma.makerCheckerRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        processedAt: new Date(),
      },
    });

    if (executeCallback) {
      await executeCallback(request.payload);
    }

    return updated;
  }

  async reject(
    requestId: string,
    rejectorId: string,
    note: string,
  ): Promise<MakerCheckerRequest> {
    const request = await this.prisma.makerCheckerRequest.findFirst({
      where: { id: requestId, tenantId: this.ctx.tenantId },
    });

    if (!request) {
      throw new NotFoundException('Maker-checker request not found');
    }

    if (request.initiatedBy === rejectorId) {
      throw new ForbiddenException('Maker cannot be the checker');
    }

    return this.prisma.makerCheckerRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedBy: rejectorId,
        rejectionNote: note,
        processedAt: new Date(),
      },
    });
  }

  async getPendingRequests(): Promise<MakerCheckerRequest[]> {
    return this.prisma.makerCheckerRequest.findMany({
      where: {
        tenantId: this.ctx.tenantId,
        status: 'PENDING_APPROVAL',
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
