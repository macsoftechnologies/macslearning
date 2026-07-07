import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssessmentResult, AssessmentResultDocument } from './schemas/assessmentResult.schema';
import { Attempt, AttemptDocument } from '../exams/schemas/attempt.schema';
import { VideoQuizAnswer, VideoQuizAnswerDocument } from '../content/schemas/video-quiz-answer.schema';

@Injectable()
export class ResultsService {
  constructor(
    @InjectModel(AssessmentResult.name) private resultModel: Model<AssessmentResultDocument>,
    @InjectModel(Attempt.name) private attemptModel: Model<AttemptDocument>,
    @InjectModel(VideoQuizAnswer.name) private videoQuizAnswerModel: Model<VideoQuizAnswerDocument>,
  ) {}

  async getMyResults(organizationId: string, studentId: string) {
    return this.resultModel.find({ organizationId, studentId, isPublished: true }).populate('examId', 'title');
  }

  async getMyAttempts(organizationId: string, studentId: string) {
    return this.attemptModel.find({ organizationId, studentId }).populate('examId', 'title courseId').sort({ createdAt: -1 });
  }

  async getMyVideoQuizAnswers(organizationId: string, studentId: string) {
    return this.videoQuizAnswerModel.find({ organizationId, studentId }).populate('quizId', 'questionText type maxMarks').populate('lessonId', 'title').sort({ createdAt: -1 });
  }

  async getCourseResults(organizationId: string, courseId: string) {
    return this.resultModel.find({ organizationId, courseId }).populate('studentId', 'fullName email').populate('examId', 'title');
  }
}
