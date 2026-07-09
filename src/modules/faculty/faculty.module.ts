import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacultyController } from './faculty.controller';
import { FacultyService } from './faculty.service';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Submission } from '../assignments/entities/submission.entity';
import { Exam } from '../exams/entities/exam.entity';
import { Attempt } from '../exams/entities/attempt.entity';
import { Thread } from '../discussion/entities/thread.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      Enrollment,
      Assignment,
      Submission,
      Exam,
      Attempt,
      Thread,
    ]),
  ],
  controllers: [FacultyController],
  providers: [FacultyService],
})
export class FacultyModule {}
