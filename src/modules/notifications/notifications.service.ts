import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
