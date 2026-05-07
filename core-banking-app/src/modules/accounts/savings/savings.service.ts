import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { NubanUtil, TenantContext } from '@libs/common';
import { Account, AccountStatus, AccountType, ProductType } from '@prisma/client';
import { OpenSavingsDto } from './dto/open-savings.dto';

@Injectable()
export class SavingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async openAccount(dto: OpenSavingsDto): Promise<Account> {
    const { tenantId, branchId: ctxBranchId } = this.ctx;
    const branchId = dto.branchId ?? ctxBranchId;

    // 1. Validate product exists and is SAVINGS type
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, isActive: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }
    if (product.productType !== ProductType.SAVINGS) {
      throw new BadRequestException('Product is not a SAVINGS product');
    }

    // 2. Get organisation for sortCode
    const org = await this.prisma.organisation.findUnique({
      where: { id: tenantId },
    });
    if (!org || !org.sortCode) {
      throw new BadRequestException('Organisation sort code not configured');
    }

    // 3. Count existing accounts for tenant to get serial number
    const count = await this.prisma.account.count({
      where: { tenantId },
    });

    // 4. Generate NUBAN
    const accountNumber = NubanUtil.generate(org.sortCode, count + 1);

    // 5. Create Account row (Serializable transaction)
    return this.prisma.$transaction(
      async (tx) => {
        return tx.account.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            productId: dto.productId,
            branchId,
            accountNumber,
            accountType: AccountType.SAVINGS,
            status: AccountStatus.ACTIVE,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async getAccount(accountNumber: string): Promise<Account> {
    const { tenantId } = this.ctx;
    const account = await this.prisma.account.findUnique({
      where: { tenantId_accountNumber: { tenantId, accountNumber } },
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountNumber} not found`);
    }
    return account;
  }

  async closeAccount(accountId: string, reason: string): Promise<Account> {
    const { tenantId, userId } = this.ctx;
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    if (account.accountType !== AccountType.SAVINGS) {
      throw new BadRequestException('Account is not a SAVINGS account');
    }
    if (account.status === AccountStatus.CLOSED) {
      throw new BadRequestException('Account is already closed');
    }
    if (!account.currentBalance.isZero()) {
      throw new BadRequestException(
        'Account balance must be zero before closing',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        return tx.account.update({
          where: { id: accountId },
          data: {
            status: AccountStatus.CLOSED,
            closedAt: new Date(),
            closedBy: userId,
            closureReason: reason,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async listAccounts(
    customerId?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Account[]; total: number; page: number; limit: number }> {
    const { tenantId } = this.ctx;
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      accountType: AccountType.SAVINGS,
      ...(customerId ? { customerId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.account.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
