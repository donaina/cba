import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { PrismaService } from '@libs/database';
import { NubanUtil, TenantContext } from '@libs/common';
import {
  Account,
  AccountStatus,
  AccountType,
  ChequeBook,
  ChequeBookStatus,
  OverdraftFacility,
  ProductType,
} from '@prisma/client';
import { OpenCurrentDto } from './dto/open-current.dto';
import { CreateOverdraftDto } from './dto/create-overdraft.dto';
import { IssueChequeBookDto } from './dto/issue-chequebook.dto';

@Injectable()
export class CurrentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async openAccount(dto: OpenCurrentDto): Promise<Account> {
    const { tenantId, branchId: ctxBranchId } = this.ctx;
    const branchId = dto.branchId ?? ctxBranchId;

    // Validate product exists and is CURRENT type
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, isActive: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }
    if (product.productType !== ProductType.CURRENT) {
      throw new BadRequestException('Product is not a CURRENT product');
    }

    // Get organisation for sortCode
    const org = await this.prisma.organisation.findUnique({
      where: { id: tenantId },
    });
    if (!org || !org.sortCode) {
      throw new BadRequestException('Organisation sort code not configured');
    }

    // Count existing accounts for tenant to get serial number
    const count = await this.prisma.account.count({ where: { tenantId } });

    // Generate NUBAN
    const accountNumber = NubanUtil.generate(org.sortCode, count + 1);

    return this.prisma.$transaction(
      async (tx) => {
        return tx.account.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            productId: dto.productId,
            branchId,
            accountNumber,
            accountType: AccountType.CURRENT,
            status: AccountStatus.ACTIVE,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async getAccount(id: string): Promise<Account & { overdraftFacility: OverdraftFacility | null; chequeBooks: ChequeBook[] }> {
    const { tenantId } = this.ctx;
    const account = await this.prisma.account.findFirst({
      where: { id, tenantId, accountType: AccountType.CURRENT },
      include: { overdraftFacility: true, chequeBooks: true },
    });
    if (!account) {
      throw new NotFoundException(`Current account ${id} not found`);
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
    if (account.accountType !== AccountType.CURRENT) {
      throw new BadRequestException('Account is not a CURRENT account');
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
      accountType: AccountType.CURRENT,
      ...(customerId ? { customerId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.account.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async createOverdraftFacility(dto: CreateOverdraftDto): Promise<OverdraftFacility> {
    const { tenantId } = this.ctx;

    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }
    if (account.accountType !== AccountType.CURRENT) {
      throw new BadRequestException(
        'Overdraft facility can only be created for CURRENT accounts',
      );
    }
    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Account is not active');
    }

    const existing = await this.prisma.overdraftFacility.findUnique({
      where: { accountId: dto.accountId },
    });
    if (existing) {
      throw new BadRequestException(
        'Overdraft facility already exists for this account. Use update instead.',
      );
    }

    return this.prisma.overdraftFacility.create({
      data: {
        tenantId,
        accountId: dto.accountId,
        limit: new Decimal(dto.limit),
        interestRate: new Decimal(dto.interestRate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        isActive: true,
      },
    });
  }

  async updateOverdraft(
    id: string,
    dto: Partial<Pick<CreateOverdraftDto, 'limit' | 'interestRate' | 'expiryDate'>>,
  ): Promise<OverdraftFacility> {
    const { tenantId } = this.ctx;
    const facility = await this.prisma.overdraftFacility.findFirst({
      where: { id, tenantId },
    });
    if (!facility) {
      throw new NotFoundException(`Overdraft facility ${id} not found`);
    }

    return this.prisma.overdraftFacility.update({
      where: { id },
      data: {
        ...(dto.limit !== undefined && { limit: new Decimal(dto.limit) }),
        ...(dto.interestRate !== undefined && { interestRate: new Decimal(dto.interestRate) }),
        ...(dto.expiryDate !== undefined && { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null }),
      },
    });
  }

  async issueChequeBook(dto: IssueChequeBookDto): Promise<ChequeBook> {
    const { tenantId } = this.ctx;

    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }
    if (account.accountType !== AccountType.CURRENT) {
      throw new BadRequestException(
        'Cheque books can only be issued for CURRENT accounts',
      );
    }
    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Account is not active');
    }
    if (dto.startLeaf >= dto.endLeaf) {
      throw new BadRequestException('startLeaf must be less than endLeaf');
    }

    return this.prisma.chequeBook.create({
      data: {
        tenantId,
        accountId: dto.accountId,
        startLeaf: dto.startLeaf,
        endLeaf: dto.endLeaf,
        currentLeaf: dto.startLeaf,
        status: ChequeBookStatus.ACTIVE,
        issuedAt: new Date(),
      },
    });
  }
}
