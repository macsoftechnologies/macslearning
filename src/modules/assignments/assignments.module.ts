import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { Assignment } from './entities/assignment.entity';
import { Submission } from './entities/submission.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    NotificationsModule,
    AuditModule,
    EnrollmentModule,
    CoursesModule,
    TypeOrmModule.forFeature([Assignment, Submission]),
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
