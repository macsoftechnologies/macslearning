import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { Thread, ThreadSchema } from './schemas/thread.schema';
import { Reply, ReplySchema } from './schemas/reply.schema';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Thread.name, schema: ThreadSchema },
      { name: Reply.name, schema: ReplySchema },
    ]),
    NotificationsModule,
    EnrollmentModule,
  ],
  controllers: [DiscussionController],
  providers: [DiscussionService],
  exports: [DiscussionService, MongooseModule],
})
export class DiscussionModule {}
