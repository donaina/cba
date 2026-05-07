import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermission, TenantContext } from '@libs/common';
import { FixedDepositService } from './fixed-deposit.service';
import { OpenFdDto } from './dto/open-fd.dto';
import { LiquidateFdDto } from './dto/liquidate-fd.dto';

@Controller('accounts/fixed-deposit')
export class FixedDepositController {
  constructor(
    private readonly fixedDepositService: FixedDepositService,
    private readonly ctx: TenantContext,
  ) {}

  @Post()
  @RequirePermission('account:create')
  openFd(@Body() dto: OpenFdDto) {
    return this.fixedDepositService.openFd(dto);
  }

  @Get(':id')
  @RequirePermission('account:read')
  getFd(@Param('id') id: string) {
    return this.fixedDepositService.getFd(id);
  }

  @Post(':id/liquidate')
  @RequirePermission('account:close')
  liquidate(@Param('id') id: string, @Body() dto: LiquidateFdDto) {
    return this.fixedDepositService.liquidate(id, dto, this.ctx.userId);
  }
}
