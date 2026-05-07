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

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly brandingService: BrandingService,
    private readonly ctx: TenantContext,
  ) {}

  // ─── Products ─────────────────────────────────────────────────────────────

  @Post('products')
  @RequirePermission('admin:config')
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminService.createProduct(dto);
  }

  @Get('products')
  @RequirePermission('admin:read')
  listProducts() {
    return this.adminService.listProducts();
  }

  @Get('products/:id')
  @RequirePermission('admin:read')
  getProduct(@Param('id') id: string) {
    return this.adminService.getProduct(id);
  }

  @Patch('products/:id')
  @RequirePermission('admin:config')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: Partial<CreateProductDto>,
  ) {
    return this.adminService.updateProduct(id, dto);
  }

  @Post('products/:id/rate-bands')
  @RequirePermission('admin:config')
  createRateBand(
    @Param('id') productId: string,
    @Body() dto: CreateRateBandDto,
  ) {
    return this.adminService.createRateBand(productId, dto);
  }

  // ─── Transaction Types ─────────────────────────────────────────────────────

  @Post('transaction-types')
  @RequirePermission('admin:config')
  createTransactionType(@Body() dto: CreateTransactionTypeDto) {
    return this.adminService.createTransactionType(dto);
  }

  @Get('transaction-types')
  @RequirePermission('admin:read')
  listTransactionTypes() {
    return this.adminService.listTransactionTypes();
  }

  // ─── Tax Rates ─────────────────────────────────────────────────────────────

  @Post('tax-rates')
  @RequirePermission('admin:config')
  @HttpCode(HttpStatus.CREATED)
  setTaxRate(@Body() dto: SetTaxRateDto) {
    return this.adminService.setTaxRate(dto);
  }

  // ─── Branches ──────────────────────────────────────────────────────────────

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

  @Get('branches')
  @RequirePermission('admin:read')
  listBranches() {
    return this.adminService.listBranches();
  }

  // ─── Maker-Checker Rules ───────────────────────────────────────────────────

  @Post('maker-checker-rules')
  @RequirePermission('admin:config')
  createMakerCheckerRule(@Body() dto: CreateMakerCheckerRuleDto) {
    return this.adminService.createMakerCheckerRule(dto);
  }

  // ─── Branding ──────────────────────────────────────────────────────────────

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

  @Get('branding/logo')
  async getLogo(): Promise<{ dataUri: string | null }> {
    const dataUri = await this.brandingService.getLogoAsDataUri(
      this.ctx.tenantId,
    );
    return { dataUri };
  }
}
