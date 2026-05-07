import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { BvnService } from './bvn.service';
import { CreditBureauService } from './credit-bureau.service';
import { RequirePermission } from '@libs/common';
import { VerifyBvnDto } from './dto/verify-bvn.dto';
import { PullCreditReportDto } from './dto/pull-credit-report.dto';

@Controller('kyc')
export class KycController {
  constructor(
    private readonly bvnService: BvnService,
    private readonly creditBureauService: CreditBureauService,
  ) {}

  @Post('bvn/verify')
  @RequirePermission('customer:update')
  verifyBvn(@Body() dto: VerifyBvnDto) {
    return this.bvnService.verifyBvn(dto);
  }

  @Post('credit-report')
  @RequirePermission('loan:apply')
  pullCreditReport(@Body() dto: PullCreditReportDto) {
    return this.creditBureauService.pullCreditReport(dto);
  }

  @Get('credit-report/:customerId')
  @RequirePermission('loan:read')
  getCreditReport(@Param('customerId') customerId: string) {
    return this.creditBureauService.getCreditReports(customerId);
  }
}
