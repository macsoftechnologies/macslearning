import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
    private dataSource: DataSource,
  ) {}

  async createNotification(
    organizationId: string,
    userId: string,
    title: string,
    message: string,
    type: string = 'SYSTEM',
    link?: string,
  ) {
    const notification = this.notificationRepository.create({
      organizationId,
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
    });
    const savedNotification =
      await this.notificationRepository.save(notification);

    // Emit to WebSocket directly
    try {
      this.gateway.sendNotification(userId, savedNotification);
    } catch (e) {}

    return savedNotification;
  }

  async createNotificationsBulk(
    organizationId: string,
    userIds: string[],
    title: string,
    message: string,
    type: string = 'SYSTEM',
    link?: string,
  ) {
    if (!userIds || userIds.length === 0) return;

    const notifications = userIds.map((userId) => ({
      organizationId,
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
    }));

    // Bulk insert for performance
    await this.notificationRepository.insert(notifications);

    // Emit to WebSocket for each user if connected
    // This assumes gateway.sendNotification can be called in a loop, or we could add a bulk emit method
    userIds.forEach((userId) => {
      try {
        this.gateway.sendNotification(userId, notifications.find(n => n.userId === userId));
      } catch (e) {}
    });
  }

  async broadcast(title: string, message: string) {
    // 1. Fetch all active user IDs
    const users = await this.dataSource.query('SELECT id, organizationId FROM user WHERE status = "ACTIVE" AND isDeleted = 0');
    
    if (!users || users.length === 0) return { success: true, count: 0 };

    const notifications = users.map((u: any) => ({
      organizationId: u.organizationId || 'SYSTEM',
      userId: u.id,
      title,
      message,
      type: 'SYSTEM',
      isRead: false,
    }));

    // Insert in batches if large, but we'll do one bulk for now
    await this.notificationRepository.insert(notifications);

    // Try emitting to all connected users
    users.forEach((u: any) => {
      try {
        this.gateway.sendNotification(u.id, notifications.find((n: any) => n.userId === u.id));
      } catch (e) {}
    });

    return { success: true, count: users.length };
  }

  async getUserNotifications(
    organizationId: string,
    userId: string,
    queryDto: PaginationQueryDto,
  ) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (organizationId) {
      queryBuilder.andWhere('notification.organizationId = :organizationId', {
        organizationId,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(notification.title LIKE :search OR notification.message LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, totalItems] = await queryBuilder
      .orderBy('notification.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getUnreadCount(organizationId: string, userId: string) {
    const where: any = { userId, isRead: false };
    if (organizationId) where.organizationId = organizationId;
    return this.notificationRepository.count({
      where,
    });
  }

  async markAsRead(
    organizationId: string,
    userId: string,
    notificationId: string,
  ) {
    const criteria: any = { id: notificationId, userId };
    if (organizationId) criteria.organizationId = organizationId;

    await this.notificationRepository.update(criteria, { isRead: true });
    const notification = await this.notificationRepository.findOne({
      where: criteria,
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async markAllAsRead(organizationId: string, userId: string) {
    const criteria: any = { userId, isRead: false };
    if (organizationId) criteria.organizationId = organizationId;

    return this.notificationRepository.update(criteria, { isRead: true });
  }
}
