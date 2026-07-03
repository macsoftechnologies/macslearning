import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Enrollment, EnrollmentDocument } from './schemas/enrollment.schema';

@Processor('enrollment')
export class EnrollmentProcessor {
  private readonly logger = new Logger(EnrollmentProcessor.name);

  constructor(@InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>) {}

  @Process('checkStatus')
  async handleCheckStatus(job: Job) {
    this.logger.debug('Start checking enrollment statuses...');
    const expiredEnrollments = await this.enrollmentModel.updateMany(
      { status: 'ACTIVE', expiresAt: { $lt: new Date() } },
      { $set: { status: 'EXPIRED' } }
    );
    this.logger.debug(`Expired ${expiredEnrollments.modifiedCount} enrollments.`);
    this.logger.debug('Finished checking enrollment statuses.');
  }
}
