import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { LessonProgress } from './entities/lessonProgress.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { EnrollmentModule } from '../enrollment/enrollment.module';

@Module({
  imports: [
    EnrollmentModule,
    TypeOrmModule.forFeature([LessonProgress, Lesson]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
