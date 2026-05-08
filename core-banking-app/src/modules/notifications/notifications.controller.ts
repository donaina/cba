import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { RequirePermission } from '@libs/common';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Publish a notification (SMS/email/in-app) via RabbitMQ' })
  @Post('send')
  @RequirePermission('notification:send')
  send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.publish(dto);
  }

  @ApiOperation({ summary: 'List notification logs' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Filter by customer UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('logs')
  @RequirePermission('notification:read')
  listLogs(
    @Query('customerId') customerId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.notificationsService.listLogs(customerId, Number(page), Number(limit));
  }
}
