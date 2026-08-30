import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranscriptsController } from './transcripts.controller';
import { TranscriptsService } from './transcripts.service';
import { OfflineGrade } from '../manual-grades/entities/offline-grade.entity';
import { Course } from '../courses/entities/course.entity';
import { User } from '../users/entities/user.entity';
import { Semester } from '../semesters/entities/semester.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { Program } from '../programs/entities/program.entity';
import { AcademicBatch } from './entities/academic-batch.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OfflineGrade, 
      Course, 
      User, 
      Semester, 
      Enrollment, 
      Program, 
      AcademicBatch
    ])
  ],
  controllers: [TranscriptsController],
  providers: [TranscriptsService]
})
export class TranscriptsModule {}
