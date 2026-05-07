import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission, TenantContext } from '@libs/common';
import { LoansService } from './loans.service';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { RepayLoanDto } from './dto/repay-loan.dto';

@Controller('loans')
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly ctx: TenantContext,
  ) {}

  @Post('apply')
  @RequirePermission('loan:apply')
  apply(@Body() dto: ApplyLoanDto) {
    return this.loansService.apply(dto);
  }

  @Get()
  @RequirePermission('loan:read')
  findAll(@Query('customerId') customerId?: string) {
    return this.loansService.findAll(customerId);
  }

  @Get(':id')
  @RequirePermission('loan:read')
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Post(':id/approve')
  @RequirePermission('loan:approve')
  approve(@Param('id') id: string, @Body() dto: ApproveLoanDto) {
    return this.loansService.approve(id, dto, this.ctx.userId);
  }

  @Post(':id/decline')
  @RequirePermission('loan:approve')
  decline(@Param('id') id: string, @Body('reason') reason: string) {
    return this.loansService.decline(id, reason, this.ctx.userId);
  }

  @Post(':id/disburse')
  @RequirePermission('loan:disburse')
  disburse(@Param('id') id: string, @Body() dto: DisburseLoanDto) {
    return this.loansService.disburse(id, dto, this.ctx.userId);
  }

  @Post(':id/repay')
  @RequirePermission('txn:transfer')
  repay(@Param('id') id: string, @Body() dto: RepayLoanDto) {
    return this.loansService.repay(id, dto);
  }

  @Get(':id/schedule')
  @RequirePermission('loan:read')
  getSchedule(@Param('id') id: string) {
    return this.loansService.getSchedule(id);
  }

  @Post(':id/write-off')
  @RequirePermission('loan:write-off')
  writeOff(@Param('id') id: string) {
    return this.loansService.writeOff(id, this.ctx.userId);
  }
}
