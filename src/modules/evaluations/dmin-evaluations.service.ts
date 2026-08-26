import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DMinEvaluation } from './entities/dmin-evaluation.entity';

@Injectable()
export class DMinEvaluationsService {
  constructor(
    @InjectRepository(DMinEvaluation)
    private dminRepo: Repository<DMinEvaluation>,
  ) {}

  async findAll(organizationId: string, query?: { studentId?: string; programId?: string; status?: string }) {
    const where: any = { organizationId };
    if (query?.studentId) where.studentId = query.studentId;
    if (query?.programId) where.programId = query.programId;
    if (query?.status) where.status = query.status;

    return this.dminRepo.find({
      where,
      order: { submittedAt: 'DESC' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const record = await this.dminRepo.findOne({
      where: { id, organizationId },
    });
    if (!record) {
      throw new NotFoundException('D.Min Submission record not found');
    }
    return record;
  }

  async createSubmission(
    organizationId: string,
    studentId: string,
    data: {
      programId: string;
      courseId?: string;
      modularTitle: string;
      documentUrl: string;
      documentName?: string;
      fileSizeBytes?: number;
    },
  ) {
    const evaluation = this.dminRepo.create({
      organizationId,
      studentId,
      ...data,
      status: 'SUBMITTED',
    });
    return this.dminRepo.save(evaluation);
  }

  async evaluateSubmission(
    organizationId: string,
    id: string,
    reviewerId: string,
    data: {
      status: string; // 'APPROVED', 'REVISION_REQUESTED', 'REJECTED', 'UNDER_REVIEW'
      marksObtained?: number;
      grade?: string;
      facultyFeedback?: string;
      adminFeedback?: string;
    },
  ) {
    const record = await this.findOne(organizationId, id);

    if (data.status) record.status = data.status;
    if (data.marksObtained !== undefined) record.marksObtained = data.marksObtained;
    if (data.grade) record.grade = data.grade;
    if (data.facultyFeedback) record.facultyFeedback = data.facultyFeedback;
    if (data.adminFeedback) record.adminFeedback = data.adminFeedback;

    record.reviewedBy = reviewerId;
    record.reviewedAt = new Date();

    return this.dminRepo.save(record);
  }

  async deleteSubmission(organizationId: string, id: string) {
    const record = await this.findOne(organizationId, id);
    return this.dminRepo.remove(record);
  }
}
