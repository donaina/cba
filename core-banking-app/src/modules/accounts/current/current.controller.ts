import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '@libs/common';
import { CurrentService } from './current.service';
import { OpenCurrentDto } from './dto/open-current.dto';
import { CreateOverdraftDto } from './dto/create-overdraft.dto';
import { IssueChequeBookDto } from './dto/issue-chequebook.dto';

@Controller('accounts/current')
export class CurrentController {
  constructor(private readonly currentService: CurrentService) {}

  @Post()
  @RequirePermission('account:create')
  openAccount(@Body() dto: OpenCurrentDto) {
    return this.currentService.openAccount(dto);
  }

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

  @Get(':id')
  @RequirePermission('account:read')
  getAccount(@Param('id') id: string) {
    return this.currentService.getAccount(id);
  }

  @Post(':id/close')
  @RequirePermission('account:close')
  closeAccount(@Param('id') id: string, @Body('reason') reason: string) {
    return this.currentService.closeAccount(id, reason);
  }

  @Post('overdraft')
  @RequirePermission('account:create')
  createOverdraft(@Body() dto: CreateOverdraftDto) {
    return this.currentService.createOverdraftFacility(dto);
  }

  @Post('chequebooks')
  @RequirePermission('account:create')
  issueChequeBook(@Body() dto: IssueChequeBookDto) {
    return this.currentService.issueChequeBook(dto);
  }
}
