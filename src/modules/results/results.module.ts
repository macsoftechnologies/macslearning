import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { AssessmentResult } from './entities/assessmentResult.entity';
import { Attempt } from '../exams/entities/attempt.entity';
import { VideoQuizAnswer } from '../content/entities/video-quiz-answer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssessmentResult, Attempt, VideoQuizAnswer]),
  ],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
