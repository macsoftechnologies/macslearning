import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectLiveSession } from './entities/subject-live-session.entity';
import { Course } from '../courses/entities/course.entity';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { LiveSessionsService } from './live-sessions.service';
import { LiveSessionsController } from './live-sessions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubjectLiveSession,
      Course,
      AcademicBatch,
      Enrollment,
      User,
    ]),
  ],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService],
  exports: [LiveSessionsService],
})
export class LiveSessionsModule {}
