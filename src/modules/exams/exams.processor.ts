import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attempt } from './entities/attempt.entity';
import { ExamsService } from './exams.service';

@Processor('exams')
export class ExamsProcessor {
  private readonly logger = new Logger(ExamsProcessor.name);

  constructor(
    @InjectRepository(Attempt) private attemptRepository: Repository<Attempt>,
    private examsService: ExamsService,
  ) {}

  @Process('autoSubmit')
  async handleAutoSubmit(job: Job) {
    this.logger.debug(
      `Starting auto-submit job for attempt ${job.data.attemptId}...`,
    );

    const attempt = await this.attemptRepository.findOne({
      where: { id: job.data.attemptId },
    });
    if (!attempt || attempt.status !== 'IN_PROGRESS') {
      this.logger.debug(`Attempt not found or already processed.`);
      return;
    }

    await this.examsService.submitAttempt(
      attempt.organizationId.toString(),
      attempt.studentId.toString(),
      attempt.examId.toString(),
      attempt.answers,
    );

    await this.attemptRepository.update(job.data.attemptId, {
      status: 'AUTO_SUBMITTED',
    });

    this.logger.debug(
      `Finished auto-submit job for attempt ${job.data.attemptId}.`,
    );
  }
}
