import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermission } from '@libs/common';
import { ReportsService } from './reports.service';
import { StatementQueryDto } from './dto/statement-query.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { LoanPortfolioQueryDto } from './dto/loan-portfolio-query.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Get account statement (JSON)' })
  @Get('statement')
  @RequirePermission('report:read')
  getStatement(@Query() dto: StatementQueryDto) {
    return this.reportsService.getStatement(dto);
  }

  @ApiOperation({ summary: 'Download account statement as PDF' })
  @ApiResponse({ status: 200, description: 'PDF binary stream', content: { 'application/pdf': {} } })
  @Get('statement/pdf')
  @RequirePermission('report:read')
  async getStatementPdf(@Query() dto: StatementQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.getStatementPdf(dto);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="statement.pdf"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Get trial balance report' })
  @Get('trial-balance')
  @RequirePermission('report:read')
  getTrialBalance(@Query() dto: TrialBalanceQueryDto) {
    return this.reportsService.getTrialBalance(dto);
  }

  @ApiOperation({ summary: 'Get loan portfolio report' })
  @Get('loan-portfolio')
  @RequirePermission('report:read')
  getLoanPortfolio(@Query() dto: LoanPortfolioQueryDto) {
    return this.reportsService.getLoanPortfolio(dto);
  }
}
