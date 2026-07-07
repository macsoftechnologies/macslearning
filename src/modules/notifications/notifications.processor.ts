import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { NotificationsGateway } from './notifications.gateway';
import { Logger } from '@nestjs/common';

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private readonly gateway: NotificationsGateway
  ) {}

  @Process('send_notification')
  async handleSendNotification(job: Job) {
    this.logger.debug(`Processing notification job: ${job.id}`);
    const { organizationId, userId, title, message, type, link } = job.data;

    // Save to DB
    const notification = new this.notificationModel({
      organizationId,
      userId,
      title,
      message,
      type,
      link,
      isRead: false
    });
    const savedNotification = await notification.save();

    // Emit via WebSocket
    this.gateway.sendNotification(userId, savedNotification);

    return savedNotification;
  }
}
