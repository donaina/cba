import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@libs/database';
import { TenantContext, JwtPayload, sha256, generateRefreshToken, generateOtp } from '@libs/common';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { User, Role, Permission } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 7;
const OTP_TTL_MINUTES = 10;
const ACCESS_TOKEN_EXPIRY = '15m';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly ctx: TenantContext,
  ) {}

  // ── Login ────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // If tenantCode provided, resolve org first
    let tenantId: string | undefined;
    if (dto.tenantCode) {
      const org = await this.prisma.organisation.findFirst({
        where: { tenantCode: dto.tenantCode, isActive: true },
      });
      if (!org) {
        throw new UnauthorizedException('Invalid credentials');
      }
      tenantId = org.id;
    }

    // Find user
    const whereClause = tenantId
      ? { tenantId, email: dto.email, isActive: true }
      : { email: dto.email, isActive: true };

    const user = await this.prisma.user.findFirst({ where: whereClause });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify tenant is active (when no tenantCode was given, verify now)
    if (!tenantId) {
      const org = await this.prisma.organisation.findFirst({
        where: { id: user.tenantId, isActive: true },
      });
      if (!org) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Resolve branchId — take first branch from UserBranchAccess
    const branchAccess = await this.prisma.userBranchAccess.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    const branchId = branchAccess?.branchId ?? '';

    // Build permissions
    const permissions = await this.buildPermissions(user.id, user.tenantId);

    // Create session
    const rawRefreshToken = generateRefreshToken();
    const refreshTokenHash = sha256(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        refreshTokenHash,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        isActive: true,
        expiresAt,
      },
    });

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Issue access token
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      branchId,
      sessionId: session.id,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  // ── Refresh ──────────────────────────────────────────────────────────────

  async refresh(
    dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = sha256(dto.refreshToken);

    const session = await this.prisma.session.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: session.userId, tenantId: session.tenantId, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer active');
    }

    // Resolve branchId
    const branchAccess = await this.prisma.userBranchAccess.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    const branchId = branchAccess?.branchId ?? '';

    const permissions = await this.buildPermissions(user.id, user.tenantId);

    // Rotate refresh token
    const newRawRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = sha256(newRawRefreshToken);
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      branchId,
      sessionId: session.id,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    return { accessToken, refreshToken: newRawRefreshToken };
  }

  // ── Logout ───────────────────────────────────────────────────────────────

  async logout(sessionId: string, tenantId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, tenantId },
      data: { isActive: false },
    });
  }

  // ── Request password reset ───────────────────────────────────────────────

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    // Verify user exists (don't leak info — silently succeed)
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
    });

    if (!user) {
      // Silently succeed to avoid user enumeration
      return;
    }

    const otp = generateOtp();
    const otpHash = sha256(otp);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_TTL_MINUTES);

    await this.prisma.passwordResetOtp.create({
      data: {
        email: dto.email,
        otpHash,
        expiresAt,
        used: false,
      },
    });

    // In production this would be sent via a notification service
    console.log(
      `[AuthService] Password reset OTP for ${dto.email}: ${otp} (expires ${expiresAt.toISOString()})`,
    );
  }

  // ── Reset password ───────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const otpHash = sha256(dto.otp);

    const otpRecord = await this.prisma.passwordResetOtp.findFirst({
      where: {
        email: dto.email,
        otpHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      });

      // Mark OTP as used
      await tx.passwordResetOtp.update({
        where: { id: otpRecord.id },
        data: { used: true },
      });

      // Invalidate all sessions for this user
      await tx.session.updateMany({
        where: { userId: user.id, tenantId: user.tenantId },
        data: { isActive: false },
      });
    });
  }

  // ── Create user ──────────────────────────────────────────────────────────

  async createUser(dto: CreateUserDto, tenantId: string): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? null,
        passwordHash,
        isActive: true,
        mustChangePassword: true,
      },
    });

    // If branchId provided, create UserBranchAccess
    if (dto.branchId) {
      await this.prisma.userBranchAccess.create({
        data: {
          userId: user.id,
          branchId: dto.branchId,
          allBranches: false,
          canApprove: false,
        },
      });
    }

    return user;
  }

  // ── Create role ──────────────────────────────────────────────────────────

  async createRole(dto: CreateRoleDto, tenantId: string): Promise<Role> {
    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        isActive: true,
      },
    });

    if (dto.permissionCodes.length > 0) {
      // Look up all requested permissions
      const permissions = await this.prisma.permission.findMany({
        where: { code: { in: dto.permissionCodes } },
      });

      const foundCodes = permissions.map((p) => p.code);
      const missing = dto.permissionCodes.filter((c) => !foundCodes.includes(c));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Unknown permission codes: ${missing.join(', ')}`,
        );
      }

      await this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }

    return role;
  }

  // ── List users ───────────────────────────────────────────────────────────

  async listUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          include: { role: { select: { id: true, name: true, isActive: true } } },
        },
        branchAccess: {
          include: { branch: { select: { id: true, name: true } } },
        },
      },
    });
  }

  // ── Get user ─────────────────────────────────────────────────────────────

  async getUser(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          include: { role: { select: { id: true, name: true, isActive: true } } },
        },
        branchAccess: {
          include: { branch: { select: { id: true, name: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Update user ──────────────────────────────────────────────────────────

  async updateUser(id: string, dto: UpdateUserDto, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const { branchId, ...userFields } = dto;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: { ...userFields },
      });

      if (branchId !== undefined) {
        await tx.userBranchAccess.deleteMany({ where: { userId: id } });
        if (branchId) {
          await tx.userBranchAccess.create({
            data: { userId: id, branchId, allBranches: false, canApprove: false },
          });
        }
      }

      return result;
    });

    return updated;
  }

  // ── Assign role ──────────────────────────────────────────────────────────

  async assignRole(userId: string, roleId: string, tenantId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
  }

  // ── Remove role ──────────────────────────────────────────────────────────

  async removeRole(userId: string, roleId: string, tenantId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
  }

  // ── List roles ───────────────────────────────────────────────────────────

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { rolePermissions: true, userRoles: true } },
      },
    });
  }

  // ── Get role ─────────────────────────────────────────────────────────────

  async getRole(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  // ── Update role ──────────────────────────────────────────────────────────

  async updateRole(id: string, dto: UpdateRoleDto, tenantId: string) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException('Role not found');

    const { permissionCodes, ...roleFields } = dto;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id }, data: { ...roleFields } });

      if (permissionCodes !== undefined) {
        // Validate all codes exist
        const permissions = await tx.permission.findMany({
          where: { code: { in: permissionCodes } },
        });
        const foundCodes = permissions.map((p) => p.code);
        const missing = permissionCodes.filter((c) => !foundCodes.includes(c));
        if (missing.length > 0) {
          throw new BadRequestException(`Unknown permission codes: ${missing.join(', ')}`);
        }

        // Replace permissions
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
          });
        }
      }

      return updated;
    });
  }

  // ── List permissions ─────────────────────────────────────────────────────

  async listPermissions(): Promise<Permission[]> {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async buildPermissions(
    userId: string,
    tenantId: string,
  ): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: { select: { name: true, isActive: true, tenantId: true } },
      },
    });

    const activeRoles = userRoles.filter(
      (ur) => ur.role.isActive && ur.role.tenantId === tenantId,
    );

    // SUPER_ADMIN gets every seeded permission automatically
    const isSuperAdmin = activeRoles.some((ur) => ur.role.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      const all = await this.prisma.permission.findMany({ select: { code: true } });
      return all.map((p) => p.code);
    }

    const roleIds = activeRoles.map((ur) => ur.roleId);
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: { select: { code: true } } },
    });

    return [...new Set(rolePerms.map((rp) => rp.permission.code))];
  }
}
