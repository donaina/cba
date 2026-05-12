import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public, RequirePermission, CurrentUser, JwtPayload } from '@libs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @ApiOperation({ summary: 'Refresh token' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @ApiOperation({ summary: 'Logout' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sessionId, user.tenantId);
  }

  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 202, description: 'OTP sent if account exists' })
  @Post('request-password-reset')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List staff users' })
  @ApiBearerAuth()
  @Get('users')
  @RequirePermission('user:read')
  listUsers(@CurrentUser() user: JwtPayload) {
    return this.authService.listUsers(user.tenantId);
  }

  @ApiOperation({ summary: 'Get staff user' })
  @ApiBearerAuth()
  @Get('users/:id')
  @RequirePermission('user:read')
  getUser(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.authService.getUser(id, user.tenantId);
  }

  @ApiOperation({ summary: 'Create staff user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiBearerAuth()
  @Post('users')
  @RequirePermission('user:create')
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.authService.createUser(dto, user.tenantId);
  }

  @ApiOperation({ summary: 'Update staff user' })
  @ApiBearerAuth()
  @Patch('users/:id')
  @RequirePermission('user:update')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.authService.updateUser(id, dto, user.tenantId);
  }

  @ApiOperation({ summary: 'Assign role to user' })
  @ApiResponse({ status: 201, description: 'Role assigned' })
  @ApiBearerAuth()
  @Post('users/:id/roles')
  @RequirePermission('role:manage')
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.authService.assignRole(id, dto.roleId, user.tenantId);
  }

  @ApiOperation({ summary: 'Remove role from user' })
  @ApiResponse({ status: 204, description: 'Role removed' })
  @ApiBearerAuth()
  @Delete('users/:id/roles/:roleId')
  @RequirePermission('role:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.authService.removeRole(id, roleId, user.tenantId);
  }

  // ── Roles ─────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List roles' })
  @ApiBearerAuth()
  @Get('roles')
  @RequirePermission('role:manage')
  listRoles(@CurrentUser() user: JwtPayload) {
    return this.authService.listRoles(user.tenantId);
  }

  @ApiOperation({ summary: 'Get role with permissions' })
  @ApiBearerAuth()
  @Get('roles/:id')
  @RequirePermission('role:manage')
  getRole(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.authService.getRole(id, user.tenantId);
  }

  @ApiOperation({ summary: 'Create role' })
  @ApiResponse({ status: 201, description: 'Role created' })
  @ApiBearerAuth()
  @Post('roles')
  @RequirePermission('role:manage')
  @HttpCode(HttpStatus.CREATED)
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.authService.createRole(dto, user.tenantId);
  }

  @ApiOperation({ summary: 'Update role' })
  @ApiBearerAuth()
  @Patch('roles/:id')
  @RequirePermission('role:manage')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.authService.updateRole(id, dto, user.tenantId);
  }

  // ── Permissions ───────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all available permissions' })
  @ApiBearerAuth()
  @Get('permissions')
  @RequirePermission('role:manage')
  listPermissions() {
    return this.authService.listPermissions();
  }
}
