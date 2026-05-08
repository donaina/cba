import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { RequirePermission } from '@libs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Create customer', description: 'Onboard a new individual or corporate customer.' })
  @ApiResponse({ status: 201, description: 'Customer created' })
  @Post()
  @RequirePermission('customer:create')
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.customersService.createCustomer(dto);
  }

  @ApiOperation({ summary: 'List / search customers' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by name, phone, or BVN' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated customer list' })
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

  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @Get(':id')
  @RequirePermission('customer:read')
  getCustomer(@Param('id') id: string) {
    return this.customersService.getCustomer(id);
  }

  @ApiOperation({ summary: 'Update customer' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @Patch(':id')
  @RequirePermission('customer:update')
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.updateCustomer(id, dto);
  }

  @ApiOperation({ summary: 'Upgrade KYC tier', description: 'Re-evaluate the customer KYC tier based on submitted documents.' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @Post(':id/upgrade-kyc')
  @RequirePermission('customer:update')
  upgradeKyc(@Param('id') id: string) {
    return this.customersService.checkAndUpgradeKycTier(id);
  }
}
