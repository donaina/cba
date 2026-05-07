import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@libs/database';
import { TenantContext, sha256, generateRefreshToken } from '@libs/common';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Injectable()
export class BaasService {
  private readonly logger = new Logger(BaasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly httpService: HttpService,
  ) {}

  async createApiKey(dto: CreateApiKeyDto) {
    const tenantId = this.ctx.tenantId;

    const raw = uuidv4();
    const keyHash = sha256(raw);
    const prefix = raw.slice(0, 8);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyHash,
        prefix,
        scopes: dto.scopes,
        isActive: true,
        createdBy: this.ctx.userId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        usageCount: 0,
      },
    });

    // rawKey is only returned once — never stored in plaintext
    return { ...apiKey, rawKey: raw };
  }

  async revokeApiKey(id: string) {
    const tenantId = this.ctx.tenantId;

    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    return this.prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy: this.ctx.userId,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        prefix: true,
        scopes: true,
        isActive: true,
        revokedAt: true,
        revokedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listApiKeys() {
    const tenantId = this.ctx.tenantId;

    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        usageCount: true,
        isActive: true,
        expiresAt: true,
        createdBy: true,
        revokedAt: true,
        revokedBy: true,
        createdAt: true,
        updatedAt: true,
        // keyHash intentionally excluded
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWebhook(dto: CreateWebhookDto) {
    const tenantId = this.ctx.tenantId;
    const secret = generateRefreshToken(); // 64 hex chars

    return this.prisma.webhook.create({
      data: {
        tenantId,
        name: dto.name,
        url: dto.url,
        secret,
        events: dto.events,
        status: 'ACTIVE',
        maxRetries: 5,
      },
    });
  }

  async listWebhooks() {
    const tenantId = this.ctx.tenantId;

    return this.prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteWebhook(id: string) {
    const tenantId = this.ctx.tenantId;

    const webhook = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    return this.prisma.webhook.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async dispatchEvent(event: string, payload: object, tenantId: string): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        events: { has: event },
      },
    });

    for (const webhook of webhooks) {
      const timestamp = Date.now();
      const signature = createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload) + timestamp.toString())
        .digest('hex');

      // Create delivery record
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          tenantId,
          webhookId: webhook.id,
          event,
          payload: payload as object,
          status: 'PENDING',
          attemptCount: 0,
        },
      });

      // Fire and forget
      this.httpService
        .post(webhook.url, payload, {
          headers: {
            'X-CBA-Signature': signature,
            'X-CBA-Timestamp': timestamp.toString(),
            'X-CBA-Event': event,
          },
        })
        .subscribe({
          next: async (res) => {
            await this.prisma.webhookDelivery.update({
              where: { id: delivery.id },
              data: {
                status: 'SUCCESS',
                responseCode: res.status,
                attemptCount: 1,
                lastAttemptAt: new Date(),
              },
            });
          },
          error: async (err: Error) => {
            await this.prisma.webhookDelivery.update({
              where: { id: delivery.id },
              data: {
                status: 'FAILED',
                errorMessage: err.message,
                attemptCount: 1,
                lastAttemptAt: new Date(),
                nextRetryAt: new Date(Date.now() + 60000),
              },
            });
          },
        });
    }
  }
}
