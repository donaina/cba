import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RequirePermission } from '@libs/common';
import { GlService } from './gl.service';
import { CreateGlAccountDto } from './dto/create-gl-account.dto';
import { UpdateGlAccountDto } from './dto/update-gl-account.dto';

@Controller('gl')
export class GlController {
  constructor(private readonly glService: GlService) {}

  @Post('accounts')
  @RequirePermission('gl:post')
  createAccount(@Body() dto: CreateGlAccountDto) {
    return this.glService.createAccount(dto);
  }

  @Get('accounts')
  @RequirePermission('gl:read')
  listAccounts() {
    return this.glService.listAccounts();
  }

  @Get('accounts/:id')
  @RequirePermission('gl:read')
  getAccount(@Param('id') id: string) {
    return this.glService.getAccount(id);
  }

  @Patch('accounts/:id')
  @RequirePermission('gl:post')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateGlAccountDto) {
    return this.glService.updateAccount(id, dto);
  }
}
