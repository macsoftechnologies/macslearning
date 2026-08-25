import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemestersController } from './semesters.controller';
import { SemestersService } from './semesters.service';
import { Semester } from './entities/semester.entity';
import { ProgramCourseMapping } from '../programs/entities/program-course-mapping.entity';
import { Course } from '../courses/entities/course.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Semester, ProgramCourseMapping, Course])],
  controllers: [SemestersController],
  providers: [SemestersService],
  exports: [SemestersService]
})
export class SemestersModule {}
