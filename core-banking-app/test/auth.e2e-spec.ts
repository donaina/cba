import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../src/modules/auth/guards/permission.guard';
import { TenantContextModule } from '../libs/common/src/tenant/tenant-context.module';

const TEST_JWT_SECRET = 'test-e2e-secret';

const mockPrisma = {
  organisation: { findFirst: jest.fn(), findUnique: jest.fn() },
  user: { findFirst: jest.fn(), update: jest.fn() },
  userBranchAccess: { findFirst: jest.fn(), create: jest.fn() },
  userRole: { findMany: jest.fn() },
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordResetOtp: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  rolePermission: { createMany: jest.fn() },
  role: { create: jest.fn() },
  permission: { findMany: jest.fn() },
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('correct-password', 1);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
        TenantContextModule,
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
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
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 when body is empty', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });

    it('returns 401 when tenantCode is not found', () => {
      mockPrisma.organisation.findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@bank.com', password: 'secret', tenantCode: 'UNKNOWN' })
        .expect(401);
    });

    it('returns 401 when user email does not exist', () => {
      mockPrisma.organisation.findFirst.mockResolvedValue({
        id: 'tenant-id',
        tenantCode: 'BANK01',
        isActive: true,
      });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@bank.com', password: 'secret', tenantCode: 'BANK01' })
        .expect(401);
    });

    it('returns 401 when password is wrong', () => {
      mockPrisma.organisation.findFirst.mockResolvedValue({
        id: 'tenant-id',
        tenantCode: 'BANK01',
        isActive: true,
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-id',
        tenantId: 'tenant-id',
        email: 'user@bank.com',
        passwordHash,
        isActive: true,
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@bank.com', password: 'wrong-password', tenantCode: 'BANK01' })
        .expect(401);
    });

    it('returns 200 with accessToken and refreshToken on valid credentials', async () => {
      mockPrisma.organisation.findFirst.mockResolvedValue({
        id: 'tenant-id',
        tenantCode: 'BANK01',
        isActive: true,
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-id',
        tenantId: 'tenant-id',
        email: 'user@bank.com',
        passwordHash,
        isActive: true,
      });
      mockPrisma.userBranchAccess.findFirst.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockPrisma.session.create.mockResolvedValue({ id: 'session-id' });
      mockPrisma.user.update.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@bank.com', password: 'correct-password', tenantCode: 'BANK01' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');
    });
  });
});
