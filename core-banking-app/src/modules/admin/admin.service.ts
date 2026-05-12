import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { Decimal } from 'decimal.js';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateTransactionTypeDto } from './dto/create-transaction-type.dto';
import { SetTaxRateDto } from './dto/set-tax-rate.dto';
import { CreateMakerCheckerRuleDto } from './dto/create-maker-checker-rule.dto';
import { CreateRateBandDto } from './dto/create-rate-band.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  // ─── Products ─────────────────────────────────────────────────────────────

  async createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        tenantId: this.ctx.tenantId,
        name: dto.name,
        code: dto.code,
        productType: dto.productType,
        description: dto.description,
        minBalance:
          dto.minBalance !== undefined
            ? new Decimal(dto.minBalance)
            : undefined,
        maxBalance:
          dto.maxBalance !== undefined
            ? new Decimal(dto.maxBalance)
            : undefined,
        interestRate:
          dto.interestRate !== undefined
            ? new Decimal(dto.interestRate)
            : undefined,
        minTenorDays: dto.minTenorDays,
        maxTenorDays: dto.maxTenorDays,
        glAccountId: dto.glAccountId,
      },
    });
  }

  async listProducts() {
    return this.prisma.product.findMany({
      where: { tenantId: this.ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
      include: { rateBands: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async updateProduct(id: string, dto: Partial<CreateProductDto>) {
    const existing = await this.prisma.product.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.productType !== undefined && { productType: dto.productType }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.minBalance !== undefined && {
          minBalance: new Decimal(dto.minBalance),
        }),
        ...(dto.maxBalance !== undefined && {
          maxBalance: new Decimal(dto.maxBalance),
        }),
        ...(dto.interestRate !== undefined && {
          interestRate: new Decimal(dto.interestRate),
        }),
        ...(dto.minTenorDays !== undefined && {
          minTenorDays: dto.minTenorDays,
        }),
        ...(dto.maxTenorDays !== undefined && {
          maxTenorDays: dto.maxTenorDays,
        }),
        ...(dto.glAccountId !== undefined && { glAccountId: dto.glAccountId }),
      },
    });
  }

  // ─── Rate Bands ────────────────────────────────────────────────────────────

  async createRateBand(productId: string, dto: CreateRateBandDto) {
    return this.prisma.rateBand.create({
      data: {
        tenantId: this.ctx.tenantId,
        productId,
        minAmount: new Decimal(dto.minAmount),
        maxAmount: new Decimal(dto.maxAmount),
        rate: new Decimal(dto.rate),
      },
    });
  }

  async getRateBands(productId: string) {
    return this.prisma.rateBand.findMany({
      where: { tenantId: this.ctx.tenantId, productId },
      orderBy: { minAmount: 'asc' },
    });
  }

  // ─── Transaction Types ─────────────────────────────────────────────────────

  async createTransactionType(dto: CreateTransactionTypeDto) {
    return this.prisma.transactionTypeConfig.create({
      data: {
        tenantId: this.ctx.tenantId,
        code: dto.code,
        name: dto.name,
        category: dto.category,
        flatFee: new Decimal(dto.flatFee),
        percentageFee: new Decimal(dto.percentageFee),
        minFee: new Decimal(dto.minFee),
        maxFee: new Decimal(dto.maxFee),
        vatApplicable: dto.vatApplicable,
        whtApplicable: dto.whtApplicable,
        requiresApprovalAbove:
          dto.requiresApprovalAbove !== undefined
            ? new Decimal(dto.requiresApprovalAbove)
            : undefined,
        approvalChannels: dto.approvalChannels,
      },
    });
  }

  async listTransactionTypes() {
    return this.prisma.transactionTypeConfig.findMany({
      where: { tenantId: this.ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Tax Rates ─────────────────────────────────────────────────────────────

  async setTaxRate(dto: SetTaxRateDto) {
    const effectiveDate = new Date(dto.effectiveDate);
    const now = new Date();

    // Expire all currently active configs for this taxType
    await this.prisma.taxConfiguration.updateMany({
      where: {
        tenantId: this.ctx.tenantId,
        taxType: dto.taxType,
        isActive: true,
      },
      data: {
        isActive: false,
        expiryDate: effectiveDate,
      },
    });

    return this.prisma.taxConfiguration.create({
      data: {
        tenantId: this.ctx.tenantId,
        taxType: dto.taxType,
        rate: new Decimal(dto.rate),
        effectiveDate,
        isActive: true,
        createdBy: this.ctx.userId,
      },
    });
  }

  async getCurrentTaxRate(taxType: string) {
    const now = new Date();

    return this.prisma.taxConfiguration.findFirst({
      where: {
        tenantId: this.ctx.tenantId,
        taxType: taxType as any,
        isActive: true,
        effectiveDate: { lte: now },
      },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  // ─── Branches ──────────────────────────────────────────────────────────────

  async createBranch(
    name: string,
    code: string,
    address?: string,
    branchType?: string,
  ) {
    return this.prisma.branch.create({
      data: {
        tenantId: this.ctx.tenantId,
        name,
        code,
        address,
        branchType: (branchType as any) ?? 'BRANCH',
      },
    });
  }

  async listBranches() {
    return this.prisma.branch.findMany({
      where: { tenantId: this.ctx.tenantId },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Maker-Checker Rules ───────────────────────────────────────────────────

  async listMakerCheckerRules() {
    return this.prisma.makerCheckerConfig.findMany({
      where: { tenantId: this.ctx.tenantId },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }

  async toggleMakerCheckerRule(id: string, isActive: boolean) {
    const rule = await this.prisma.makerCheckerConfig.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
    });
    if (!rule) throw new NotFoundException('Rule not found');
    return this.prisma.makerCheckerConfig.update({ where: { id }, data: { isActive } });
  }

  async createMakerCheckerRule(dto: CreateMakerCheckerRuleDto) {
    return this.prisma.makerCheckerConfig.upsert({
      where: {
        tenantId_module_action: {
          tenantId: this.ctx.tenantId,
          module: dto.module,
          action: dto.action,
        },
      },
      create: {
        tenantId: this.ctx.tenantId,
        module: dto.module,
        action: dto.action,
        requiresApprovalAbove:
          dto.requiresApprovalAbove !== undefined
            ? new Decimal(dto.requiresApprovalAbove)
            : undefined,
        channels: dto.channels,
        requiredApprovers: dto.requiredApprovers,
        ttlMinutes: dto.ttlMinutes,
        isActive: true,
      },
      update: {
        requiresApprovalAbove:
          dto.requiresApprovalAbove !== undefined
            ? new Decimal(dto.requiresApprovalAbove)
            : undefined,
        channels: dto.channels,
        requiredApprovers: dto.requiredApprovers,
        ttlMinutes: dto.ttlMinutes,
        isActive: true,
      },
    });
  }

  // ─── Value Date ────────────────────────────────────────────────────────────

  async computeValueDate(date: Date): Promise<Date> {
    let current = new Date(date);
    let maxIterations = 60; // safety limit

    while (maxIterations-- > 0) {
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Check if this date is a holiday
      const startOfDay = new Date(
        Date.UTC(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
        ),
      );
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      const holiday = await this.prisma.workingCalendar.findFirst({
        where: {
          tenantId: this.ctx.tenantId,
          isHoliday: true,
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      });

      if (holiday) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Not a weekend and not a holiday — this is a valid working day
      break;
    }

    return current;
  }
}
