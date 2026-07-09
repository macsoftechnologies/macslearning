import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { CourseModule as CourseModuleModel } from './entities/courseModule.entity';
import { Lesson } from './entities/lesson.entity';
import { LessonCheckpoint } from './entities/lessonCheckpoint.entity';
import { LessonCheckpointAnswer } from './entities/lessonCheckpointAnswer.entity';
import { LessonCheckpointController } from '../content/lesson-checkpoint.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { LessonProgress } from '../progress/entities/lessonProgress.entity';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { VideoQuiz } from './entities/video-quiz.entity';
import { VideoQuizAnswer } from './entities/video-quiz-answer.entity';
import { Course } from '../courses/entities/course.entity';

@Module({
  imports: [
    NotificationsModule,
    EnrollmentModule,
    TypeOrmModule.forFeature([
      CourseModuleModel,
      Lesson,
      LessonCheckpoint,
      LessonCheckpointAnswer,
      LessonProgress,
      VideoQuiz,
      VideoQuizAnswer,
      Course,
    ]),
  ],
  controllers: [ContentController, LessonCheckpointController],
  providers: [ContentService],
  exports: [ContentService, TypeOrmModule],
})
export class ContentModule {}
