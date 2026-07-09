import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course } from './entities/course.entity';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course]),
    forwardRef(() => EnrollmentModule),
    OrganizationsModule,
    AuditModule,
    NotificationsModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService, TypeOrmModule],
})
export class CoursesModule {}
