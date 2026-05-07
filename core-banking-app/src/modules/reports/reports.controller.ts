import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { RequirePermission } from '@libs/common';
import { ReportsService } from './reports.service';
import { StatementQueryDto } from './dto/statement-query.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { LoanPortfolioQueryDto } from './dto/loan-portfolio-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('statement')
  @RequirePermission('report:read')
  getStatement(@Query() dto: StatementQueryDto) {
    return this.reportsService.getStatement(dto);
  }

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

  @Get('trial-balance')
  @RequirePermission('report:read')
  getTrialBalance(@Query() dto: TrialBalanceQueryDto) {
    return this.reportsService.getTrialBalance(dto);
  }

  @Get('loan-portfolio')
  @RequirePermission('report:read')
  getLoanPortfolio(@Query() dto: LoanPortfolioQueryDto) {
    return this.reportsService.getLoanPortfolio(dto);
  }
}
