import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { Thread } from './entities/thread.entity';
import { Reply } from './entities/reply.entity';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Thread, Reply]),
    NotificationsModule,
    EnrollmentModule,
    CoursesModule,
  ],
  controllers: [DiscussionController],
  providers: [DiscussionService],
  exports: [DiscussionService, TypeOrmModule],
})
export class DiscussionModule {}
