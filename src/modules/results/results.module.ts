import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { AssessmentResult, AssessmentResultSchema } from './schemas/assessmentResult.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssessmentResult.name, schema: AssessmentResultSchema },
    ])
  ],
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService]
})
export class ResultsModule {}
