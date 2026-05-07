import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { RequirePermission } from '@libs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermission('customer:create')
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.customersService.createCustomer(dto);
  }

  @Get()
  @RequirePermission('customer:read')
  listCustomers(
    @Query('q') q?: string,
    @Query('page') page?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;

    if (q && q.trim().length > 0) {
      return this.customersService.search(q.trim(), pageNum);
    }

    return this.customersService.listCustomers(pageNum);
  }

  @Get(':id')
  @RequirePermission('customer:read')
  getCustomer(@Param('id') id: string) {
    return this.customersService.getCustomer(id);
  }

  @Patch(':id')
  @RequirePermission('customer:update')
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.updateCustomer(id, dto);
  }

  @Post(':id/upgrade-kyc')
  @RequirePermission('customer:update')
  upgradeKyc(@Param('id') id: string) {
    return this.customersService.checkAndUpgradeKycTier(id);
  }
}
