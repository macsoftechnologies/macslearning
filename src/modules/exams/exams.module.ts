import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamsProcessor } from './exams.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { CoursesModule } from '../courses/courses.module';
import { Exam } from './entities/exam.entity';
import { Question } from './entities/question.entity';
import { Attempt } from './entities/attempt.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';

@Module({
  imports: [
    NotificationsModule,
    EnrollmentModule,
    CoursesModule,
    BullModule.registerQueue({
      name: 'exams',
    }),
    TypeOrmModule.forFeature([Exam, Question, Attempt, AssessmentResult]),
  ],
  controllers: [ExamsController],
  providers: [ExamsService, ExamsProcessor],
  exports: [ExamsService, TypeOrmModule],
})
export class ExamsModule {}
