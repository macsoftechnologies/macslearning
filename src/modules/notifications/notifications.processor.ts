import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { Logger } from '@nestjs/common';

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
  ) {}

  @Process('send_notification')
  async handleSendNotification(job: Job) {
    this.logger.debug(`Processing notification job: ${job.id}`);
    const { organizationId, userId, title, message, type, link } = job.data;

    // Save to DB
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

    // Emit via WebSocket
    this.gateway.sendNotification(userId, savedNotification);

    return savedNotification;
  }
}
