import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getUserNotifications(
    @Request() req: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.notificationsService.getUserNotifications(
      req.user.organizationId,
      req.user.userId,
      query,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationsService.getUnreadCount(
      req.user.organizationId,
      req.user.userId,
    );
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') notificationId: string) {
    return this.notificationsService.markAsRead(
      req.user.organizationId,
      req.user.userId,
      notificationId,
    );
  }

  @Post('mark-all-read')
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(
      req.user.organizationId,
      req.user.userId,
    );
  }
}
