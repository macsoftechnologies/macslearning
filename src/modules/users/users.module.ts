import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Organization } from '../organizations/entities/org.entity';
import { AuditModule } from '../audit/audit.module';
import { FacultyModule } from '../faculty/faculty.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Organization]), AuditModule, FacultyModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
