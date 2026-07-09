import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { UsersModule } from '../users/users.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { AuditModule } from '../audit/audit.module';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Enrollment]),
    UsersModule,
    EnrollmentModule,
    AuditModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
