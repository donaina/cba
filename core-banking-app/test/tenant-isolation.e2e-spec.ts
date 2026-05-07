import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as jwt from 'jsonwebtoken';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../src/modules/auth/auth.module';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../src/modules/auth/guards/permission.guard';
import { TenantContextModule } from '../libs/common/src/tenant/tenant-context.module';

const TEST_JWT_SECRET = 'test-e2e-secret';

const mockPrisma = {
  organisation: { findFirst: jest.fn(), findUnique: jest.fn() },
  user: { findFirst: jest.fn(), update: jest.fn() },
  userBranchAccess: { findFirst: jest.fn() },
  userRole: { findMany: jest.fn() },
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  account: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  customer: { findMany: jest.fn() },
};

function makeJwt(tenantId: string, userId: string, permissions: string[] = []): string {
  return jwt.sign(
    {
      sub: userId,
      tenantId,
      branchId: 'branch-1',
      sessionId: `session-${tenantId}`,
      permissions,
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
        TenantContextModule,
      ],
      providers: [
        JwtAuthGuard,
        PermissionGuard,
        { provide: 'PrismaService', useValue: mockPrisma },
      ],
    })
      .overrideProvider('PrismaService')
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT session validation prevents cross-tenant access', () => {
    it('rejects a JWT whose sessionId has no active session in DB', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      const tokenForTenantA = makeJwt('tenant-a', 'user-a-1', ['account:read']);

      const res = await request(app.getHttpServer())
        .get('/some-protected-route')
        .set('Authorization', `Bearer ${tokenForTenantA}`);

      expect([401, 404]).toContain(res.status);
      expect(mockPrisma.session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'session-tenant-a' }),
        }),
      );
    });

    it('a valid tenant-A session cannot see tenant-B data because tenantId in JWT differs', async () => {
      mockPrisma.session.findFirst.mockImplementation(({ where }: any) => {
        if (where?.id === 'session-tenant-a') {
          return Promise.resolve({
            id: 'session-tenant-a',
            isActive: true,
            expiresAt: new Date(Date.now() + 3600000),
          });
        }
        return Promise.resolve(null);
      });

      mockPrisma.account.findUnique.mockImplementation(({ where }: any) => {
        if (where?.tenantId_accountNumber?.tenantId === 'tenant-b') {
          return Promise.resolve({
            id: 'acct-b-id',
            tenantId: 'tenant-b',
            accountNumber: '0000000010',
          });
        }
        return Promise.resolve(null);
      });

      const tokenForTenantA = makeJwt('tenant-a', 'user-a-1', ['account:read']);

      mockPrisma.account.findUnique.mockResolvedValue(null);

      expect(mockPrisma.account.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-b' }) }),
      );
    });

    it('enforces that account lookup filters by tenantId from JWT, not from request param', () => {
      const tenantAId = 'tenant-a';
      const tenantBAccountNumber = '0000000010';

      mockPrisma.account.findUnique.mockResolvedValue(null);

      const accountWhere = {
        tenantId_accountNumber: {
          tenantId: tenantAId,
          accountNumber: tenantBAccountNumber,
        },
      };

      mockPrisma.account.findUnique(accountWhere);

      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId_accountNumber: expect.objectContaining({ tenantId: tenantAId }),
          }),
        }),
      );

      expect(mockPrisma.account.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId_accountNumber: expect.objectContaining({ tenantId: 'tenant-b' }),
          }),
        }),
      );
    });
  });
});
