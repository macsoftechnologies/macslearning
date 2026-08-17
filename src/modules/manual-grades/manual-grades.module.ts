import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualGradesController } from './manual-grades.controller';
import { ManualGradesService } from './manual-grades.service';
import { OfflineGrade } from './entities/offline-grade.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OfflineGrade, Enrollment, User, AssessmentResult])],
  controllers: [ManualGradesController],
  providers: [ManualGradesService]
})
export class ManualGradesModule {}
