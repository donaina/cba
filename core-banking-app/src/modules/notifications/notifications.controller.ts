import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { RequirePermission } from '@libs/common';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @RequirePermission('notification:send')
  send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.publish(dto);
  }

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
