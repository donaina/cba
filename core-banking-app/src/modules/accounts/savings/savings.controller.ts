import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RequirePermission } from '@libs/common';
import { SavingsService } from './savings.service';
import { OpenSavingsDto } from './dto/open-savings.dto';

@ApiTags('Accounts — Savings')
@ApiBearerAuth()
@Controller('accounts/savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @ApiOperation({ summary: 'Open savings account' })
  @ApiResponse({ status: 201, description: 'Account opened, NUBAN number assigned' })
  @Post()
  @RequirePermission('account:open')
  openAccount(@Body() dto: OpenSavingsDto) {
    return this.savingsService.openAccount(dto);
  }

  @ApiOperation({ summary: 'List savings accounts' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  @RequirePermission('account:read')
  listAccounts(
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.savingsService.listAccounts(
      customerId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiOperation({ summary: 'Get savings account by ID' })
  @ApiParam({ name: 'id' })
  @Get(':id')
  @RequirePermission('account:read')
  getAccount(@Param('id') id: string) {
    return this.savingsService.getAccount(id);
  }

  @ApiOperation({ summary: 'Close savings account' })
  @ApiParam({ name: 'id' })
  @Post(':id/close')
  @RequirePermission('account:close')
  closeAccount(@Param('id') id: string, @Body('reason') reason: string) {
    return this.savingsService.closeAccount(id, reason);
  }
}
