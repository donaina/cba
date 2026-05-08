import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RequirePermission } from '@libs/common';
import { GlService } from './gl.service';
import { CreateGlAccountDto } from './dto/create-gl-account.dto';
import { UpdateGlAccountDto } from './dto/update-gl-account.dto';

@ApiTags('General Ledger')
@ApiBearerAuth()
@Controller('gl')
export class GlController {
  constructor(private readonly glService: GlService) {}

  @ApiOperation({ summary: 'Create a GL account in the chart of accounts' })
  @ApiResponse({ status: 201, description: 'GL account created' })
  @Post('accounts')
  @RequirePermission('gl:post')
  createAccount(@Body() dto: CreateGlAccountDto) {
    return this.glService.createAccount(dto);
  }

  @ApiOperation({ summary: 'List all GL accounts (chart of accounts)' })
  @Get('accounts')
  @RequirePermission('gl:read')
  listAccounts() {
    return this.glService.listAccounts();
  }

  @ApiOperation({ summary: 'Get a GL account by ID' })
  @ApiParam({ name: 'id', description: 'GL account UUID' })
  @Get('accounts/:id')
  @RequirePermission('gl:read')
  getAccount(@Param('id') id: string) {
    return this.glService.getAccount(id);
  }

  @ApiOperation({ summary: 'Update a GL account' })
  @ApiParam({ name: 'id', description: 'GL account UUID' })
  @Patch('accounts/:id')
  @RequirePermission('gl:post')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateGlAccountDto) {
    return this.glService.updateAccount(id, dto);
  }
}
