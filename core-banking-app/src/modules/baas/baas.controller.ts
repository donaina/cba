import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RequirePermission } from '@libs/common';
import { BaasService } from './baas.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@ApiTags('BaaS')
@ApiBearerAuth()
@Controller('baas')
export class BaasController {
  constructor(private readonly baasService: BaasService) {}

  @ApiOperation({ summary: 'Create an API key (stored as SHA-256 hash)' })
  @ApiResponse({ status: 201, description: 'API key created; raw key shown once, not stored in plaintext' })
  @Post('api-keys')
  @RequirePermission('admin:config')
  createApiKey(@Body() dto: CreateApiKeyDto) {
    return this.baasService.createApiKey(dto);
  }

  @ApiOperation({ summary: 'List API keys (hashed values only)' })
  @Get('api-keys')
  @RequirePermission('admin:read')
  listApiKeys() {
    return this.baasService.listApiKeys();
  }

  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id', description: 'API key UUID' })
  @Delete('api-keys/:id')
  @RequirePermission('admin:config')
  revokeApiKey(@Param('id') id: string) {
    return this.baasService.revokeApiKey(id);
  }

  @ApiOperation({ summary: 'Register a webhook endpoint (HMAC-SHA256 signed)' })
  @ApiResponse({ status: 201, description: 'Webhook endpoint registered' })
  @Post('webhooks')
  @RequirePermission('admin:config')
  createWebhook(@Body() dto: CreateWebhookDto) {
    return this.baasService.createWebhook(dto);
  }

  @ApiOperation({ summary: 'List registered webhook endpoints' })
  @Get('webhooks')
  @RequirePermission('admin:read')
  listWebhooks() {
    return this.baasService.listWebhooks();
  }

  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @Delete('webhooks/:id')
  @RequirePermission('admin:config')
  deleteWebhook(@Param('id') id: string) {
    return this.baasService.deleteWebhook(id);
  }
}
