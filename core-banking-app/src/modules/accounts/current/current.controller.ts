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
import { CurrentService } from './current.service';
import { OpenCurrentDto } from './dto/open-current.dto';
import { CreateOverdraftDto } from './dto/create-overdraft.dto';
import { IssueChequeBookDto } from './dto/issue-chequebook.dto';

@ApiTags('Accounts — Current')
@ApiBearerAuth()
@Controller('accounts/current')
export class CurrentController {
  constructor(private readonly currentService: CurrentService) {}

  @ApiOperation({ summary: 'Open current account' })
  @ApiResponse({ status: 201, description: 'Account opened, NUBAN number assigned' })
  @Post()
  @RequirePermission('account:open')
  openAccount(@Body() dto: OpenCurrentDto) {
    return this.currentService.openAccount(dto);
  }

  @ApiOperation({ summary: 'List current accounts' })
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
    return this.currentService.listAccounts(
      customerId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiOperation({ summary: 'Get current account by ID' })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @Get(':id')
  @RequirePermission('account:read')
  getAccount(@Param('id') id: string) {
    return this.currentService.getAccount(id);
  }

  @ApiOperation({ summary: 'Close current account' })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Account closed' })
  @Post(':id/close')
  @RequirePermission('account:close')
  closeAccount(@Param('id') id: string, @Body('reason') reason: string) {
    return this.currentService.closeAccount(id, reason);
  }

  @ApiOperation({ summary: 'Create overdraft facility on a current account' })
  @ApiResponse({ status: 201, description: 'Overdraft facility created' })
  @Post('overdraft')
  @RequirePermission('account:open')
  createOverdraft(@Body() dto: CreateOverdraftDto) {
    return this.currentService.createOverdraftFacility(dto);
  }

  @ApiOperation({ summary: 'Issue cheque book for a current account' })
  @ApiResponse({ status: 201, description: 'Cheque book issued' })
  @Post('chequebooks')
  @RequirePermission('account:open')
  issueChequeBook(@Body() dto: IssueChequeBookDto) {
    return this.currentService.issueChequeBook(dto);
  }
}
