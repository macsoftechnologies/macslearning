import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentProcessor } from './enrollment.processor';
import { Enrollment } from './entities/enrollment.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Course } from '../courses/entities/course.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { LessonProgress } from '../progress/entities/lessonProgress.entity';
import { PaymentModule } from '../payment/payment.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Enrollment,
      Payment,
      Course,
      Lesson,
      LessonProgress,
    ]),
    BullModule.registerQueue({
      name: 'enrollment',
    }),
    PaymentModule,
    forwardRef(() => CoursesModule),
    require('../notifications/notifications.module').NotificationsModule,
  ],
  controllers: [EnrollmentController],
  providers: [EnrollmentService, EnrollmentProcessor],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
