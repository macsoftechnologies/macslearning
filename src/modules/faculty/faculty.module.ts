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
import { User } from '../users/entities/user.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { Program } from '../programs/entities/program.entity';
import { Semester } from '../semesters/entities/semester.entity';

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
      User,
      Lesson,
      Program,
      Semester,
    ]),
  ],
  controllers: [FacultyController],
  providers: [FacultyService],
  exports: [FacultyService],
})
export class FacultyModule {}
