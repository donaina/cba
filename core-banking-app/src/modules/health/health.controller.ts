import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '@libs/database';
import { Public } from '@libs/common';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (e) {
      return this.getStatus(key, false, { message: (e as Error).message });
    }
  }
}

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  @ApiOperation({ summary: 'Full health check (database connectivity)' })
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prismaIndicator.isHealthy('database')]);
  }

  @ApiOperation({ summary: 'Readiness probe' })
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.prismaIndicator.isHealthy('database')]);
  }

  @ApiOperation({ summary: 'Liveness probe' })
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
