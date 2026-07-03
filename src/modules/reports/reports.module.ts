import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Payment, PaymentSchema } from '../payment/schemas/payment.schema';
import { Enrollment, EnrollmentSchema } from '../enrollment/schemas/enrollment.schema';
import { LessonProgress, LessonProgressSchema } from '../progress/schemas/lessonProgress.schema';
import { AssessmentResult, AssessmentResultSchema } from '../results/schemas/assessmentResult.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
      { name: AssessmentResult.name, schema: AssessmentResultSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
