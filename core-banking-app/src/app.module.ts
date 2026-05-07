import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

import { DatabaseModule } from '@libs/database';
import {
  CommonModule,
  TenantMiddleware,
  AuditLogInterceptor,
  IdempotencyMiddleware,
} from '@libs/common';

import { GlModule } from '@modules/gl/gl.module';
import { AuthModule } from '@modules/auth/auth.module';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '@modules/auth/guards/permission.guard';
import { CustomersModule } from '@modules/customers/customers.module';
import { KycModule } from '@modules/kyc/kyc.module';
import { DocumentsModule } from '@modules/documents/documents.module';
import { AdminModule } from '@modules/admin/admin.module';
import { AccountsModule } from '@modules/accounts/accounts.module';
import { LoansModule } from '@modules/loans/loans.module';
import { TransactionsModule } from '@modules/transactions/transactions.module';
import { NibssModule } from '@modules/nibss/nibss.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { ReportsModule } from '@modules/reports/reports.module';
import { AmlModule } from '@modules/aml/aml.module';
import { BaasModule } from '@modules/baas/baas.module';
import { AuditModule } from '@modules/audit/audit.module';
import { HealthModule } from '@modules/health/health.module';

const FINANCIAL_ROUTES = [
  '/api/v1/transactions/deposit',
  '/api/v1/transactions/withdraw',
  '/api/v1/transactions/transfer',
  '/api/v1/transactions/nip-transfer',
  '/api/v1/loans/repay',
];

@Module({
  imports: [
    // Infrastructure
    DatabaseModule,
    CommonModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    RabbitMQModule.forRoot({
      exchanges: [
        { name: 'cba.transactions', type: 'topic' },
        { name: 'cba.dlx', type: 'topic' },
      ],
      uri: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
      connectionInitOptions: { wait: false },
    }),

    // Domain modules
    GlModule,
    AuthModule,
    CustomersModule,
    KycModule,
    DocumentsModule,
    AdminModule,
    AccountsModule,
    LoansModule,
    TransactionsModule,
    NibssModule,
    NotificationsModule,
    ReportsModule,
    AmlModule,
    BaasModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');

    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        ...FINANCIAL_ROUTES.map((path) => ({
          path,
          method: RequestMethod.POST,
        })),
      );
  }
}
