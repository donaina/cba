import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BvnService } from './bvn.service';
import { CreditBureauService } from './credit-bureau.service';
import { RequirePermission } from '@libs/common';
import { VerifyBvnDto } from './dto/verify-bvn.dto';
import { PullCreditReportDto } from './dto/pull-credit-report.dto';

@ApiTags('KYC')
@ApiBearerAuth()
@Controller('kyc')
export class KycController {
  constructor(
    private readonly bvnService: BvnService,
    private readonly creditBureauService: CreditBureauService,
  ) {}

  @ApiOperation({ summary: 'Verify customer BVN via NIBSS' })
  @ApiResponse({ status: 200, description: 'BVN verified and KYC tier updated' })
  @Post('bvn/verify')
  @RequirePermission('customer:update')
  verifyBvn(@Body() dto: VerifyBvnDto) {
    return this.bvnService.verifyBvn(dto);
  }

  @ApiOperation({ summary: 'Pull credit bureau report (CRC) for a customer' })
  @ApiResponse({ status: 201, description: 'Credit report fetched and stored' })
  @Post('credit-report')
  @RequirePermission('loan:apply')
  pullCreditReport(@Body() dto: PullCreditReportDto) {
    return this.creditBureauService.pullCreditReport(dto);
  }

  @ApiOperation({ summary: 'Get stored credit reports for a customer' })
  @ApiParam({ name: 'customerId', description: 'Customer UUID' })
  @Get('credit-report/:customerId')
  @RequirePermission('kyc:credit-check')
  getCreditReport(@Param('customerId') customerId: string) {
    return this.creditBureauService.getCreditReports(customerId);
  }
}
