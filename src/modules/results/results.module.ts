import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { AssessmentResult, AssessmentResultSchema } from './schemas/assessmentResult.schema';
import { Attempt, AttemptSchema } from '../exams/schemas/attempt.schema';
import { VideoQuizAnswer, VideoQuizAnswerSchema } from '../content/schemas/video-quiz-answer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssessmentResult.name, schema: AssessmentResultSchema },
      { name: Attempt.name, schema: AttemptSchema },
      { name: VideoQuizAnswer.name, schema: VideoQuizAnswerSchema },
    ])
  ],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService]
})
export class ResultsModule {}
