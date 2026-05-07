import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '@libs/common';
import { SavingsService } from './savings.service';
import { OpenSavingsDto } from './dto/open-savings.dto';

@Controller('accounts/savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Post()
  @RequirePermission('account:create')
  openAccount(@Body() dto: OpenSavingsDto) {
    return this.savingsService.openAccount(dto);
  }

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

  @Get(':id')
  @RequirePermission('account:read')
  getAccount(@Param('id') id: string) {
    return this.savingsService.getAccount(id);
  }

  @Post(':id/close')
  @RequirePermission('account:close')
  closeAccount(@Param('id') id: string, @Body('reason') reason: string) {
    return this.savingsService.closeAccount(id, reason);
  }
}
