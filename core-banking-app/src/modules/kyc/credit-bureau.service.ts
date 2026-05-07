import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { PullCreditReportDto } from './dto/pull-credit-report.dto';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CreditBureauService {
  private readonly logger = new Logger(CreditBureauService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async pullCreditReport(dto: PullCreditReportDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId: this.ctx.tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const bureau = dto.bureau ?? 'CRC';
    const requestRef = uuidv4();

    let reportData: {
      creditScore?: number;
      classification?: string;
      totalExposure?: Decimal;
      activeLoans?: number;
      nplCount?: number;
      rawReport?: Record<string, unknown>;
    };

    if (process.env.CREDIT_BUREAU_SANDBOX === 'true') {
      this.logger.log(
        `[CREDIT BUREAU SANDBOX] Pull report request: ${JSON.stringify({ customerId: dto.customerId, bureau })}`,
      );

      reportData = {
        creditScore: 720,
        classification: 'GOOD',
        totalExposure: new Decimal('0'),
        activeLoans: 0,
        nplCount: 0,
        rawReport: {
          sandbox: true,
          bureau,
          ref: requestRef,
          creditScore: 720,
          classification: 'GOOD',
        },
      };
    } else {
      const bureauBaseUrl =
        bureau === 'CRC'
          ? (process.env.CRC_BASE_URL ?? 'https://api.creditregistry.ng')
          : (process.env.FIRST_CENTRAL_BASE_URL ?? 'https://api.firstcentral.ng');

      const bureauApiKey =
        bureau === 'CRC'
          ? (process.env.CRC_API_KEY ?? '')
          : (process.env.FIRST_CENTRAL_API_KEY ?? '');

      const response = await firstValueFrom(
        this.httpService.post(
          `${bureauBaseUrl}/credit-report`,
          {
            bvn: customer.bvn,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            requestRef,
          },
          {
            headers: {
              Authorization: `Bearer ${bureauApiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const data = response.data as Record<string, unknown>;
      reportData = {
        creditScore: data.creditScore as number | undefined,
        classification: data.classification as string | undefined,
        totalExposure: data.totalExposure
          ? new Decimal(String(data.totalExposure))
          : undefined,
        activeLoans: data.activeLoans as number | undefined,
        nplCount: data.nplCount as number | undefined,
        rawReport: data,
      };
    }

    return this.prisma.creditBureauReport.create({
      data: {
        tenantId: this.ctx.tenantId,
        customerId: dto.customerId,
        loanApplicationId: dto.loanApplicationId,
        bureau,
        requestRef,
        creditScore: reportData.creditScore,
        classification: reportData.classification,
        totalExposure: reportData.totalExposure,
        activeLoans: reportData.activeLoans,
        nplCount: reportData.nplCount,
        rawReport: reportData.rawReport as any,
      },
    });
  }

  async getCreditReports(customerId: string) {
    // Verify the customer belongs to this tenant to prevent enumeration
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId: this.ctx.tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.creditBureauReport.findMany({
      where: {
        tenantId: this.ctx.tenantId,
        customerId,
      },
      orderBy: { fetchedAt: 'desc' },
    });
  }
}
