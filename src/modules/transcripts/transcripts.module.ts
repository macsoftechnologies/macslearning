import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { TranscriptsController } from './transcripts.controller';
import { TranscriptsService } from './transcripts.service';

@Module({
  controllers: [TranscriptsController],
  providers: [TranscriptsService]
=======
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicBatch } from './entities/academic-batch.entity';
import { OfflineGrade } from './entities/offline-grade.entity';
import { TranscriptMetadata } from './entities/transcript-metadata.entity';
import { TranscriptsService } from './transcripts.service';
import { TranscriptsController } from './transcripts.controller';
import { PdfService } from './pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicBatch,
      OfflineGrade,
      TranscriptMetadata
    ])
  ],
  controllers: [TranscriptsController],
  providers: [TranscriptsService, PdfService],
  exports: [TranscriptsService]
>>>>>>> de2e6a8d3bf1245059e9b7102e13239482f7812c
})
export class TranscriptsModule {}
