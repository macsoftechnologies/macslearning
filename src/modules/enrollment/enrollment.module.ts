import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentProcessor } from './enrollment.processor';
import { Enrollment, EnrollmentSchema } from './schemas/enrollment.schema';
import { PaymentModule } from '../payment/payment.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Enrollment.name, schema: EnrollmentSchema }]),
    BullModule.registerQueue({
      name: 'enrollment',
    }),
    PaymentModule,
    forwardRef(() => CoursesModule),
    require('../notifications/notifications.module').NotificationsModule,
  ],
  controllers: [EnrollmentController],
  providers: [EnrollmentService, EnrollmentProcessor],
  exports: [EnrollmentService]
})
export class EnrollmentModule {}
