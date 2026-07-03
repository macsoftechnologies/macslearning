import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>
  ) {}

  async createNotification(organizationId: string, userId: string, title: string, message: string, type: string = 'SYSTEM', link?: string) {
    const notification = new this.notificationModel({
      organizationId,
      userId,
      title,
      message,
      type,
      link
    });
    return notification.save();
  }

  async getUserNotifications(organizationId: string, userId: string, queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = { organizationId, userId };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, totalItems] = await Promise.all([
      this.notificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.notificationModel.countDocuments(query),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getUnreadCount(organizationId: string, userId: string) {
    return this.notificationModel.countDocuments({ organizationId, userId, isRead: false });
  }

  async markAsRead(organizationId: string, userId: string, notificationId: string) {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, organizationId, userId },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async markAllAsRead(organizationId: string, userId: string) {
    return this.notificationModel.updateMany(
      { organizationId, userId, isRead: false },
      { $set: { isRead: true } }
    );
  }
}
