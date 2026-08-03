import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { UsersModule } from '../users/users.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { AuditModule } from '../audit/audit.module';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { Exam } from '../exams/entities/exam.entity';
import { Attempt } from '../exams/entities/attempt.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { LessonProgress } from '../progress/entities/lessonProgress.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Submission } from '../assignments/entities/submission.entity';
import { Program } from '../programs/entities/program.entity';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Semester } from '../semesters/entities/semester.entity';
import { OfflineGrade } from '../manual-grades/entities/offline-grade.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, 
      Enrollment, 
      Course, 
      Exam, 
      Attempt, 
      Lesson, 
      LessonProgress, 
      Assignment, 
      Submission,
      Program,
      AcademicBatch,
      Semester,
      OfflineGrade
    ]),
    UsersModule,
    EnrollmentModule,
    AuditModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
