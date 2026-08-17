import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemestersController } from './semesters.controller';
import { SemestersService } from './semesters.service';
import { Semester } from './entities/semester.entity';
import { ProgramCourseMapping } from '../programs/entities/program-course-mapping.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Semester, ProgramCourseMapping])],
  controllers: [SemestersController],
  providers: [SemestersService],
  exports: [SemestersService]
})
export class SemestersModule {}
