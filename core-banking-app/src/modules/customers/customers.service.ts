import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async createCustomer(dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        tenantId: this.ctx.tenantId,
        customerType: dto.customerType ?? 'INDIVIDUAL',
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        bvn: dto.bvn,
        nin: dto.nin,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async listCustomers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: { tenantId: this.ctx.tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({
        where: { tenantId: this.ctx.tenantId },
      }),
    ]);

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCustomer(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
      include: { documents: { where: { deletedAt: null } } },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.customerType !== undefined && {
          customerType: dto.customerType,
        }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.bvn !== undefined && { bvn: dto.bvn }),
        ...(dto.nin !== undefined && { nin: dto.nin }),
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: new Date(dto.dateOfBirth),
        }),
      },
    });
  }

  /**
   * CBN KYC tier upgrade logic:
   * - TIER_1: bvnVerified only (default)
   * - TIER_2: bvnVerified + nin verified + PHOTO document VERIFIED
   * - TIER_3: TIER_2 docs + UTILITY_BILL or PROOF_OF_ADDRESS VERIFIED
   */
  async checkAndUpgradeKycTier(customerId: string): Promise<string> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId: this.ctx.tenantId },
      include: {
        documents: {
          where: {
            tenantId: this.ctx.tenantId,
            deletedAt: null,
            status: 'VERIFIED',
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const verifiedDocTypes = customer.documents.map((d) => d.documentType);

    const hasVerifiedPhoto = verifiedDocTypes.includes('PHOTO' as any);
    const hasUtilityBill =
      verifiedDocTypes.includes('UTILITY_BILL' as any) ||
      verifiedDocTypes.includes('PROOF_OF_ADDRESS' as any);

    let newTier: 'TIER_1' | 'TIER_2' | 'TIER_3' = 'TIER_1';

    if (customer.bvnVerified) {
      newTier = 'TIER_1';

      if (customer.nin && hasVerifiedPhoto) {
        newTier = 'TIER_2';

        if (hasUtilityBill) {
          newTier = 'TIER_3';
        }
      }
    }

    if (customer.kycTier !== newTier) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { kycTier: newTier },
      });
    }

    return newTier;
  }

  async search(q: string, page = 1) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId: this.ctx.tenantId,
        OR: [
          { phone: { contains: q, mode: 'insensitive' } },
          { altPhone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { bvn: { contains: q } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
        ],
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return customers;
  }
}
