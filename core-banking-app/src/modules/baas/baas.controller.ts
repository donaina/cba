import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { RequirePermission } from '@libs/common';
import { BaasService } from './baas.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Controller('baas')
export class BaasController {
  constructor(private readonly baasService: BaasService) {}

  @Post('api-keys')
  @RequirePermission('admin:config')
  createApiKey(@Body() dto: CreateApiKeyDto) {
    return this.baasService.createApiKey(dto);
  }

  @Get('api-keys')
  @RequirePermission('admin:read')
  listApiKeys() {
    return this.baasService.listApiKeys();
  }

  @Delete('api-keys/:id')
  @RequirePermission('admin:config')
  revokeApiKey(@Param('id') id: string) {
    return this.baasService.revokeApiKey(id);
  }

  @Post('webhooks')
  @RequirePermission('admin:config')
  createWebhook(@Body() dto: CreateWebhookDto) {
    return this.baasService.createWebhook(dto);
  }

  @Get('webhooks')
  @RequirePermission('admin:read')
  listWebhooks() {
    return this.baasService.listWebhooks();
  }

  @Delete('webhooks/:id')
  @RequirePermission('admin:config')
  deleteWebhook(@Param('id') id: string) {
    return this.baasService.deleteWebhook(id);
  }
}
