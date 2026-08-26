import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemestersController } from './semesters.controller';
import { SemestersService } from './semesters.service';
import { SemestersRolloverService } from './semesters-rollover.service';
import { Semester } from './entities/semester.entity';
import { StudentCyclicProgress } from './entities/student-cyclic-progress.entity';
import { ProgramCourseMapping } from '../programs/entities/program-course-mapping.entity';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';

import { Program } from '../programs/entities/program.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Semester,
      StudentCyclicProgress,
      ProgramCourseMapping,
      Course,
      Enrollment,
      AssessmentResult,
      Program,
    ]),
  ],
  controllers: [SemestersController],
  providers: [SemestersService, SemestersRolloverService],
  exports: [SemestersService, SemestersRolloverService],
})
export class SemestersModule {}

