import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicBatchesController } from './academic-batches.controller';
import { AcademicBatchesService } from './academic-batches.service';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Thread } from '../discussion/entities/thread.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicBatch, Thread])],
  controllers: [AcademicBatchesController],
  providers: [AcademicBatchesService],
  exports: [AcademicBatchesService]
})
export class AcademicBatchesModule {}
