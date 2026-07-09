import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity';

@Processor('enrollment')
export class EnrollmentProcessor {
  private readonly logger = new Logger(EnrollmentProcessor.name);

  constructor(
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
  ) {}

  @Process('checkStatus')
  async handleCheckStatus(job: Job) {
    this.logger.debug('Start checking enrollment statuses...');
    const result = await this.enrollmentRepository.update(
      { status: 'ACTIVE', expiresAt: LessThan(new Date()) },
      { status: 'EXPIRED' },
    );
    this.logger.debug(`Expired ${result.affected} enrollments.`);
    this.logger.debug('Finished checking enrollment statuses.');
  }
}
