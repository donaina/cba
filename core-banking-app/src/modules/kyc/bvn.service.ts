import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stringSimilarity = require('string-similarity') as { compareTwoStrings: (a: string, b: string) => number };
import { PrismaService } from '@libs/database';
import { TenantContext } from '@libs/common';
import { VerifyBvnDto } from './dto/verify-bvn.dto';

interface NibssResponse {
  verified: boolean;
  nibssRef?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneMatched?: boolean;
  nameMatchScore?: number;
  rawResponse?: Record<string, unknown>;
}

@Injectable()
export class BvnService {
  private readonly logger = new Logger(BvnService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async verifyBvn(dto: VerifyBvnDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId: this.ctx.tenantId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    let nibssResult: NibssResponse;

    if (process.env.NIBSS_SANDBOX === 'true') {
      this.logger.log(
        `[NIBSS SANDBOX] BVN verification request: ${JSON.stringify({ customerId: dto.customerId, bvn: dto.bvn })}`,
      );

      nibssResult = {
        verified: true,
        nibssRef: `SANDBOX-${Date.now()}`,
        firstName: customer.firstName ?? undefined,
        lastName: customer.lastName ?? undefined,
        dateOfBirth: customer.dateOfBirth
          ? customer.dateOfBirth.toISOString().split('T')[0]
          : undefined,
        phoneMatched: true,
        nameMatchScore: 0.95,
        rawResponse: { sandbox: true, bvn: dto.bvn },
      };
    } else {
      const nibssBaseUrl = process.env.NIBSS_BASE_URL ?? 'https://api.nibss-plc.com.ng';
      const nibssApiKey = process.env.NIBSS_API_KEY ?? '';

      const response = await firstValueFrom(
        this.httpService.post(
          `${nibssBaseUrl}/bvn/verify`,
          {
            bvn: dto.bvn,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
          },
          {
            headers: {
              Authorization: `Bearer ${nibssApiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const data = response.data as Record<string, unknown>;
      const nibssFirstName = (data.firstName as string) ?? '';
      const nibssLastName = (data.lastName as string) ?? '';

      const customerFullName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const nibssFullName = [nibssFirstName, nibssLastName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const nameMatchScore =
        customerFullName && nibssFullName
          ? stringSimilarity.compareTwoStrings(customerFullName, nibssFullName)
          : 0;

      nibssResult = {
        verified: (data.verified as boolean) ?? false,
        nibssRef: data.ref as string | undefined,
        firstName: nibssFirstName || undefined,
        lastName: nibssLastName || undefined,
        dateOfBirth: data.dateOfBirth as string | undefined,
        phoneMatched: data.phoneMatched as boolean | undefined,
        nameMatchScore,
        rawResponse: data,
      };
    }

    // Create BvnVerification record
    const verification = await this.prisma.bvnVerification.upsert({
      where: {
        tenantId_bvn: {
          tenantId: this.ctx.tenantId,
          bvn: dto.bvn,
        },
      },
      create: {
        tenantId: this.ctx.tenantId,
        customerId: dto.customerId,
        bvn: dto.bvn,
        nibssRef: nibssResult.nibssRef,
        verified: nibssResult.verified,
        firstName: nibssResult.firstName,
        lastName: nibssResult.lastName,
        dateOfBirth: nibssResult.dateOfBirth,
        phoneMatched: nibssResult.phoneMatched,
        nameMatchScore: nibssResult.nameMatchScore,
        rawResponse: nibssResult.rawResponse as any,
        verifiedAt: nibssResult.verified ? new Date() : undefined,
      },
      update: {
        nibssRef: nibssResult.nibssRef,
        verified: nibssResult.verified,
        firstName: nibssResult.firstName,
        lastName: nibssResult.lastName,
        dateOfBirth: nibssResult.dateOfBirth,
        phoneMatched: nibssResult.phoneMatched,
        nameMatchScore: nibssResult.nameMatchScore,
        rawResponse: nibssResult.rawResponse as any,
        verifiedAt: nibssResult.verified ? new Date() : undefined,
      },
    });

    // Update customer bvnVerified if verified and name match score meets threshold
    const nameScore = nibssResult.nameMatchScore ?? 0;
    if (nibssResult.verified && nameScore >= 0.7) {
      await this.prisma.customer.update({
        where: { id: dto.customerId },
        data: {
          bvnVerified: true,
          bvn: dto.bvn,
        },
      });
    }

    return verification;
  }
}
