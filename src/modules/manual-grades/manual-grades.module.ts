import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualGradesController } from './manual-grades.controller';
import { ManualGradesService } from './manual-grades.service';
import { OfflineGrade } from './entities/offline-grade.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OfflineGrade])],
  controllers: [ManualGradesController],
  providers: [ManualGradesService]
})
export class ManualGradesModule {}
