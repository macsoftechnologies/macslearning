import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { Thread } from './entities/thread.entity';
import { Reply } from './entities/reply.entity';
import { Course } from '../courses/entities/course.entity';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Thread,
      Reply,
      Course,
      AcademicBatch,
      Enrollment,
      User,
    ]),
    NotificationsModule,
    EnrollmentModule,
    CoursesModule,
  ],
  controllers: [DiscussionController],
  providers: [DiscussionService],
  exports: [DiscussionService, TypeOrmModule],
})
export class DiscussionModule {}
