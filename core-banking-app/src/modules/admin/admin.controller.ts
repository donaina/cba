import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { BrandingService } from './branding.service';
import { RequirePermission } from '@libs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateTransactionTypeDto } from './dto/create-transaction-type.dto';
import { SetTaxRateDto } from './dto/set-tax-rate.dto';
import { CreateMakerCheckerRuleDto } from './dto/create-maker-checker-rule.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateRateBandDto } from './dto/create-rate-band.dto';
import { TenantContext } from '@libs/common';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly brandingService: BrandingService,
    private readonly ctx: TenantContext,
  ) {}

  // ─── Products ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a loan or deposit product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @Post('products')
  @RequirePermission('admin:config')
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminService.createProduct(dto);
  }

  @ApiOperation({ summary: 'List all products' })
  @Get('products')
  @RequirePermission('admin:read')
  listProducts() {
    return this.adminService.listProducts();
  }

  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @Get('products/:id')
  @RequirePermission('admin:read')
  getProduct(@Param('id') id: string) {
    return this.adminService.getProduct(id);
  }

  @ApiOperation({ summary: 'Update product configuration' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @Patch('products/:id')
  @RequirePermission('admin:config')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: Partial<CreateProductDto>,
  ) {
    return this.adminService.updateProduct(id, dto);
  }

  @ApiOperation({ summary: 'Add an interest rate band to a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @Post('products/:id/rate-bands')
  @RequirePermission('admin:config')
  createRateBand(
    @Param('id') productId: string,
    @Body() dto: CreateRateBandDto,
  ) {
    return this.adminService.createRateBand(productId, dto);
  }

  @ApiOperation({ summary: 'List rate bands for a product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @Get('products/:id/rate-bands')
  @RequirePermission('admin:read')
  getRateBands(@Param('id') productId: string) {
    return this.adminService.getRateBands(productId);
  }

  // ─── Transaction Types ─────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a transaction type (with fee/VAT config)' })
  @ApiResponse({ status: 201, description: 'Transaction type created' })
  @Post('transaction-types')
  @RequirePermission('admin:config')
  createTransactionType(@Body() dto: CreateTransactionTypeDto) {
    return this.adminService.createTransactionType(dto);
  }

  @ApiOperation({ summary: 'List all transaction types' })
  @Get('transaction-types')
  @RequirePermission('admin:read')
  listTransactionTypes() {
    return this.adminService.listTransactionTypes();
  }

  // ─── Tax Rates ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Set WHT or VAT rate' })
  @ApiResponse({ status: 201, description: 'Tax rate upserted' })
  @Post('tax-rates')
  @RequirePermission('admin:config')
  @HttpCode(HttpStatus.CREATED)
  setTaxRate(@Body() dto: SetTaxRateDto) {
    return this.adminService.setTaxRate(dto);
  }

  // ─── Branches ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a branch' })
  @ApiResponse({ status: 201, description: 'Branch created' })
  @Post('branches')
  @RequirePermission('admin:config')
  createBranch(@Body() dto: CreateBranchDto) {
    return this.adminService.createBranch(
      dto.name,
      dto.code,
      dto.address,
      dto.branchType,
    );
  }

  @ApiOperation({ summary: 'List all branches' })
  @Get('branches')
  @RequirePermission('admin:read')
  listBranches() {
    return this.adminService.listBranches();
  }

  @ApiOperation({ summary: 'Update branch details or status' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @Patch('branches/:id')
  @RequirePermission('admin:config')
  updateBranch(
    @Param('id') id: string,
    @Body() dto: { name?: string; address?: string; isActive?: boolean },
  ) {
    return this.adminService.updateBranch(id, dto);
  }

  // ─── Maker-Checker Rules ───────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a maker-checker approval rule' })
  @Post('maker-checker-rules')
  @RequirePermission('admin:config')
  createMakerCheckerRule(@Body() dto: CreateMakerCheckerRuleDto) {
    return this.adminService.createMakerCheckerRule(dto);
  }

  // ─── Branding ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Upload tenant logo (PNG/JPEG, used in PDF statements)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Logo uploaded to MinIO and cached as data URI' })
  @Post('branding/logo')
  @RequirePermission('admin:config')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ message: string }> {
    await this.brandingService.uploadLogo(
      file.buffer,
      file.mimetype,
      this.ctx.tenantId,
    );
    return { message: 'Logo uploaded successfully' };
  }

  @ApiOperation({ summary: 'Get tenant logo as base64 data URI' })
  @ApiResponse({ status: 200, description: 'Logo returned as data:image/png;base64 string' })
  @Get('branding/logo')
  async getLogo(): Promise<{ dataUri: string | null }> {
    const dataUri = await this.brandingService.getLogoAsDataUri(
      this.ctx.tenantId,
    );
    return { dataUri };
  }
}
