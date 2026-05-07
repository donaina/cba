import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { RequirePermission, TenantContext } from '@libs/common';
import { PrismaService } from '@libs/database';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { AccountStatus } from '@prisma/client';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  @Get(':id/balance')
  @RequirePermission('account:read')
  async getBalance(@Param('id') id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
      select: { id: true, accountNumber: true, currencyCode: true, currentBalance: true, availableBalance: true, ledgerBalance: true },
    });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return {
      id: account.id,
      accountNumber: account.accountNumber,
      currencyCode: account.currencyCode,
      currentBalance: new Decimal(account.currentBalance.toString()).toFixed(4),
      availableBalance: new Decimal(account.availableBalance.toString()).toFixed(4),
      ledgerBalance: new Decimal(account.ledgerBalance.toString()).toFixed(4),
    };
  }

  @Patch(':id/status')
  @RequirePermission('account:update')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: AccountStatus; reason?: string },
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id, tenantId: this.ctx.tenantId },
    });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    if (account.status === AccountStatus.CLOSED) {
      throw new NotFoundException('Cannot update status of a closed account');
    }

    return this.prisma.account.update({
      where: { id },
      data: { status: body.status },
    });
  }
}
