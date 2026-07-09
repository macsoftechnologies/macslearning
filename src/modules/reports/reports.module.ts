import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { User } from '../users/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { LessonProgress } from '../progress/entities/lessonProgress.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';
import { Organization } from '../organizations/entities/org.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Course,
      Payment,
      Enrollment,
      LessonProgress,
      AssessmentResult,
      Organization,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
