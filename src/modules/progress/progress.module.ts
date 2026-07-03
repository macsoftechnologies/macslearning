import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { LessonProgress, LessonProgressSchema } from './schemas/lessonProgress.schema';
import { Lesson, LessonSchema } from '../content/schemas/lesson.schema';
import { EnrollmentModule } from '../enrollment/enrollment.module';

@Module({
  imports: [
    EnrollmentModule,
    MongooseModule.forFeature([
      { name: LessonProgress.name, schema: LessonProgressSchema },
      { name: Lesson.name, schema: LessonSchema },
    ])
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService]
})
export class ProgressModule {}
