import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attempt, AttemptDocument } from './schemas/attempt.schema';
import { ExamsService } from './exams.service';

@Processor('exams')
export class ExamsProcessor {
  private readonly logger = new Logger(ExamsProcessor.name);

  constructor(
    @InjectModel(Attempt.name) private attemptModel: Model<AttemptDocument>,
    private examsService: ExamsService,
  ) {}

  @Process('autoSubmit')
  async handleAutoSubmit(job: Job) {
    this.logger.debug(`Starting auto-submit job for attempt ${job.data.attemptId}...`);
    
    const attempt = await this.attemptModel.findById(job.data.attemptId);
    if (!attempt || attempt.status !== 'IN_PROGRESS') {
      this.logger.debug(`Attempt not found or already processed.`);
      return;
    }

    await this.examsService.submitAttempt(
      attempt.organizationId.toString(), 
      attempt.studentId.toString(), 
      attempt.examId.toString(), 
      attempt.answers
    );
    
    await this.attemptModel.findByIdAndUpdate(job.data.attemptId, { status: 'AUTO_SUBMITTED' });

    this.logger.debug(`Finished auto-submit job for attempt ${job.data.attemptId}.`);
  }
}
