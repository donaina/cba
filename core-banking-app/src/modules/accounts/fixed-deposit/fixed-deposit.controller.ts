import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RequirePermission, TenantContext } from '@libs/common';
import { FixedDepositService } from './fixed-deposit.service';
import { OpenFdDto } from './dto/open-fd.dto';
import { LiquidateFdDto } from './dto/liquidate-fd.dto';

@ApiTags('Accounts — Fixed Deposit')
@ApiBearerAuth()
@Controller('accounts/fixed-deposit')
export class FixedDepositController {
  constructor(
    private readonly fixedDepositService: FixedDepositService,
    private readonly ctx: TenantContext,
  ) {}

  @ApiOperation({ summary: 'Open a fixed deposit account' })
  @ApiResponse({ status: 201, description: 'Fixed deposit opened, principal debited from source account' })
  @Post()
  @RequirePermission('account:open')
  openFd(@Body() dto: OpenFdDto) {
    return this.fixedDepositService.openFd(dto);
  }

  @ApiOperation({ summary: 'Get fixed deposit by ID' })
  @ApiParam({ name: 'id', description: 'Fixed deposit UUID' })
  @Get(':id')
  @RequirePermission('account:read')
  getFd(@Param('id') id: string) {
    return this.fixedDepositService.getFd(id);
  }

  @ApiOperation({ summary: 'Early liquidation of a fixed deposit' })
  @ApiParam({ name: 'id', description: 'Fixed deposit UUID' })
  @ApiResponse({ status: 200, description: 'FD liquidated, penalty applied, proceeds credited to source account' })
  @Post(':id/liquidate')
  @RequirePermission('account:close')
  liquidate(@Param('id') id: string, @Body() dto: LiquidateFdDto) {
    return this.fixedDepositService.liquidate(id, dto, this.ctx.userId);
  }
}
