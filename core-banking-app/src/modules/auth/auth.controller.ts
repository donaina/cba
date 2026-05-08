import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Login', description: 'Authenticate with email, password, and tenant code. Returns accessToken and refreshToken.' })
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

  @ApiOperation({ summary: 'Refresh token', description: 'Exchange a valid refresh token for a new access token.' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @ApiOperation({ summary: 'Logout', description: 'Invalidate the current session.' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sessionId, user.tenantId);
  }

  @ApiOperation({ summary: 'Request password reset', description: 'Sends a 6-digit OTP to the user email.' })
  @ApiResponse({ status: 202, description: 'OTP sent if account exists' })
  @Post('request-password-reset')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @ApiOperation({ summary: 'Reset password', description: 'Reset password using the OTP received by email.' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({ summary: 'Create user', description: 'Create a new staff user within the tenant.' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiBearerAuth()
  @Post('users')
  @RequirePermission('user:create')
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.authService.createUser(dto, user.tenantId);
  }

  @ApiOperation({ summary: 'Create role', description: 'Create a new RBAC role with assigned permissions.' })
  @ApiResponse({ status: 201, description: 'Role created' })
  @ApiBearerAuth()
  @Post('roles')
  @RequirePermission('role:create')
  @HttpCode(HttpStatus.CREATED)
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.authService.createRole(dto, user.tenantId);
  }
}
