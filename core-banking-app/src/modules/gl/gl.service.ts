import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { GLAccount } from '@prisma/client';
import { CreateGlAccountDto } from './dto/create-gl-account.dto';
import { UpdateGlAccountDto } from './dto/update-gl-account.dto';

@Injectable()
export class GlService {
  /**
   * In-memory cache for system GL accounts.
   * Key format: `{tenantId}:{code}`
   */
  private readonly systemAccountCache = new Map<string, GLAccount>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  /**
   * Returns a system GL account by code for a given tenant.
   * Populates cache on first access.
   */
  async getSystemAccount(code: string, tenantId: string): Promise<GLAccount> {
    const cacheKey = `${tenantId}:${code}`;
    const cached = this.systemAccountCache.get(cacheKey);
    if (cached) return cached;

    const account = await this.prisma.gLAccount.findFirst({
      where: { tenantId, code, isSystemAccount: true, isActive: true },
    });

    if (!account) {
      throw new NotFoundException(
        `System account ${code} not found for tenant ${tenantId}. Run the GL seed script.`,
      );
    }

    this.systemAccountCache.set(cacheKey, account);
    return account;
  }

  /**
   * Clears system account cache entries.
   * If tenantId provided, only clears that tenant's entries.
   */
  clearSystemAccountCache(tenantId?: string): void {
    if (!tenantId) {
      this.systemAccountCache.clear();
      return;
    }
    for (const key of this.systemAccountCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.systemAccountCache.delete(key);
      }
    }
  }

  /**
   * Maps a product account type to its GL control account code.
   */
  getGlControlAccount(accountType: string): string {
    const mapping: Record<string, string> = {
      SAVINGS: 'SAVINGS_CONTROL',
      CURRENT: 'CURRENT_CONTROL',
      FIXED_DEPOSIT: 'FIXED_DEPOSIT_CONTROL',
    };
    const code = mapping[accountType.toUpperCase()];
    if (!code) {
      throw new NotFoundException(
        `No GL control account mapping for account type: ${accountType}`,
      );
    }
    return code;
  }

  async createAccount(dto: CreateGlAccountDto): Promise<GLAccount> {
    return this.prisma.gLAccount.create({
      data: {
        tenantId: this.ctx.tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        level: dto.level,
        normalBalance: dto.normalBalance,
        parentId: dto.parentId ?? null,
        isSystemAccount: dto.isSystemAccount ?? false,
        description: dto.description ?? null,
        isActive: true,
      },
    });
  }

  async listAccounts(): Promise<GLAccount[]> {
    return this.prisma.gLAccount.findMany({
      where: { tenantId: this.ctx.tenantId },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  async getAccount(id: string): Promise<GLAccount> {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
    });
    if (!account) {
      throw new NotFoundException(`GL account ${id} not found`);
    }
    return account;
  }

  async updateAccount(id: string, dto: UpdateGlAccountDto): Promise<GLAccount> {
    // Verify ownership (throws 404 on tenant mismatch) AND update in same WHERE to avoid TOCTOU
    const existing = await this.getAccount(id);

    const updated = await this.prisma.gLAccount.update({
      where: { id, tenantId: existing.tenantId },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.normalBalance !== undefined && { normalBalance: dto.normalBalance }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.isSystemAccount !== undefined && { isSystemAccount: dto.isSystemAccount }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    // Invalidate cache if this is (or was) a system account
    this.clearSystemAccountCache(this.ctx.tenantId);

    return updated;
  }
}
