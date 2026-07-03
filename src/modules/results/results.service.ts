import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssessmentResult, AssessmentResultDocument } from './schemas/assessmentResult.schema';

@Injectable()
export class ResultsService {
  constructor(
    @InjectModel(AssessmentResult.name) private resultModel: Model<AssessmentResultDocument>,
  ) {}

  async getMyResults(organizationId: string, studentId: string) {
    return this.resultModel.find({ organizationId, studentId, isPublished: true }).populate('examId', 'title');
  }

  async getCourseResults(organizationId: string, courseId: string) {
    return this.resultModel.find({ organizationId, courseId }).populate('studentId', 'fullName email').populate('examId', 'title');
  }
}
