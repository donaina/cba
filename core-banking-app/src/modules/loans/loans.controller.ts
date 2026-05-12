import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RequirePermission, TenantContext } from '@libs/common';
import { LoansService } from './loans.service';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { ApproveLoanDto } from './dto/approve-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { RepayLoanDto } from './dto/repay-loan.dto';

@ApiTags('Loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly ctx: TenantContext,
  ) {}

  @ApiOperation({ summary: 'Apply for a loan' })
  @ApiResponse({ status: 201, description: 'Loan application created, pending approval' })
  @Post('apply')
  @RequirePermission('loan:apply')
  apply(@Body() dto: ApplyLoanDto) {
    return this.loansService.apply(dto);
  }

  @ApiOperation({ summary: 'List loans' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Filter by customer UUID' })
  @Get()
  @RequirePermission('loan:read')
  findAll(@Query('customerId') customerId?: string) {
    return this.loansService.findAll(customerId);
  }

  @ApiOperation({ summary: 'Get loan by ID' })
  @ApiParam({ name: 'id', description: 'Loan UUID' })
  @Get(':id')
  @RequirePermission('loan:read')
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @ApiOperation({ summary: 'Approve a loan application (maker-checker)' })
  @ApiParam({ name: 'id', description: 'Loan UUID' })
  @ApiResponse({ status: 200, description: 'Loan approved; approver must differ from applicant' })
  @Post(':id/approve')
  @RequirePermission('loan:approve')
  approve(@Param('id') id: string, @Body() dto: ApproveLoanDto) {
    return this.loansService.approve(id, dto, this.ctx.userId);
  }

  @ApiOperation({ summary: 'Decline a loan application' })
  @ApiParam({ name: 'id', description: 'Loan UUID' })
  @Post(':id/decline')
  @RequirePermission('loan:approve')
  decline(@Param('id') id: string, @Body('reason') reason: string) {
    return this.loansService.decline(id, reason, this.ctx.userId);
  }

  @ApiOperation({ summary: 'Disburse an approved loan' })
  @ApiParam({ name: 'id', description: 'Loan UUID' })
  @ApiResponse({ status: 200, description: 'Loan disbursed; LOAN_PORTFOLIO debited, customer account credited' })
  @Post(':id/disburse')
  @RequirePermission('loan:disburse')
  disburse(@Param('id') id: string, @Body() dto: DisburseLoanDto) {
    return this.loansService.disburse(id, dto, this.ctx.userId);
  }

  @ApiOperation({ summary: 'Make a loan repayment (waterfall: penalty → interest → principal)' })
  @ApiParam({ name: 'id', description: 'Loan UUID' })
  @Post(':id/repay')
  @RequirePermission('loan:repay')
  repay(@Param('id') id: string, @Body() dto: RepayLoanDto) {
    return this.loansService.repay(id, dto);
  }

  @ApiOperation({ summary: 'Get loan repayment schedule' })
  @ApiParam({ name: 'id', description: 'Loan UUID' })
  @Get(':id/schedule')
  @RequirePermission('loan:read')
  getSchedule(@Param('id') id: string) {
    return this.loansService.getSchedule(id);
  }

  @ApiOperation({ summary: 'Write off a LOST loan (DPD ≥ 360)' })
  @ApiParam({ name: 'id', description: 'Loan UUID' })
  @ApiResponse({ status: 200, description: 'Loan written off; BAD_DEBT_EXPENSE debited, LOAN_PORTFOLIO credited' })
  @Post(':id/write-off')
  @RequirePermission('loan:write-off')
  writeOff(@Param('id') id: string) {
    return this.loansService.writeOff(id, this.ctx.userId);
  }
}
