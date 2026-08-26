import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DMinEvaluation } from './entities/dmin-evaluation.entity';
import { DMinEvaluationsService } from './dmin-evaluations.service';
import { DMinEvaluationsController } from './dmin-evaluations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DMinEvaluation])],
  controllers: [DMinEvaluationsController],
  providers: [DMinEvaluationsService],
  exports: [DMinEvaluationsService],
})
export class DMinEvaluationsModule {}
