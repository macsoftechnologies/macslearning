import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranscriptsController } from './transcripts.controller';
import { TranscriptsService } from './transcripts.service';
import { OfflineGrade } from '../manual-grades/entities/offline-grade.entity';
import { Course } from '../courses/entities/course.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OfflineGrade, Course, User])
  ],
  controllers: [TranscriptsController],
  providers: [TranscriptsService]
})
export class TranscriptsModule {}
