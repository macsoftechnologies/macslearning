import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { CourseModule as CourseModuleModel, CourseModuleSchema } from './schemas/courseModule.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { LessonCheckpoint, LessonCheckpointSchema } from './schemas/lessonCheckpoint.schema';
import { LessonCheckpointAnswer, LessonCheckpointAnswerSchema } from './schemas/lessonCheckpointAnswer.schema';
import { LessonCheckpointController } from '../content/lesson-checkpoint.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { LessonProgress, LessonProgressSchema } from '../progress/schemas/lessonProgress.schema';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { VideoQuiz, VideoQuizSchema } from './schemas/video-quiz.schema';
import { VideoQuizAnswer, VideoQuizAnswerSchema } from './schemas/video-quiz-answer.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';

@Module({
  imports: [
    NotificationsModule,
    EnrollmentModule,
    MongooseModule.forFeature([
      { name: CourseModuleModel.name, schema: CourseModuleSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: LessonCheckpoint.name, schema: LessonCheckpointSchema },
      { name: LessonCheckpointAnswer.name, schema: LessonCheckpointAnswerSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
      { name: VideoQuiz.name, schema: VideoQuizSchema },
      { name: VideoQuizAnswer.name, schema: VideoQuizAnswerSchema },
      { name: Course.name, schema: CourseSchema },
    ])
  ],
  controllers: [ContentController, LessonCheckpointController],
  providers: [ContentService],
  exports: [ContentService, MongooseModule],
})
export class ContentModule {}
