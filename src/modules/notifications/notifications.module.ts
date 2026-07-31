import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { BullModule } from '@nestjs/bull';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
