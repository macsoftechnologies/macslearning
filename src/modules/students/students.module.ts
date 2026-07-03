import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { UsersModule } from '../users/users.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [UsersModule, EnrollmentModule, AuditModule],
  controllers: [StudentsController],
  providers: [StudentsService]
})
export class StudentsModule {}
