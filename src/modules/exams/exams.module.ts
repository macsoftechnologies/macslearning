import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamsProcessor } from './exams.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { Exam, ExamSchema } from './schemas/exam.schema';
import { Question, QuestionSchema } from './schemas/question.schema';
import { Attempt, AttemptSchema } from './schemas/attempt.schema';
import { AssessmentResult, AssessmentResultSchema } from '../results/schemas/assessmentResult.schema';

@Module({
  imports: [
    NotificationsModule,
    EnrollmentModule,
    BullModule.registerQueue({
      name: 'exams',
    }),
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Attempt.name, schema: AttemptSchema },
      { name: AssessmentResult.name, schema: AssessmentResultSchema },
    ])
  ],
  controllers: [ExamsController],
  providers: [ExamsService, ExamsProcessor],
  exports: [ExamsService, MongooseModule]
})
export class ExamsModule {}
