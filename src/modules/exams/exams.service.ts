import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Exam, ExamDocument } from './schemas/exam.schema';
import { Question, QuestionDocument } from './schemas/question.schema';
import { Attempt, AttemptDocument } from './schemas/attempt.schema';
import { AssessmentResult, AssessmentResultDocument } from '../results/schemas/assessmentResult.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ExamsService {
  constructor(
    @InjectModel(Exam.name) private examModel: Model<ExamDocument>,
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(Attempt.name) private attemptModel: Model<AttemptDocument>,
    @InjectModel(AssessmentResult.name) private resultModel: Model<AssessmentResultDocument>,
    @InjectQueue('exams') private examsQueue: Queue,
    private notificationsService: NotificationsService,
  ) {}

  async createExam(organizationId: string, courseId: string, createdBy: string, examData: any) {
    const exam = new this.examModel({
      ...examData,
      organizationId,
      courseId,
      createdBy,
    });
    return exam.save();
  }

  async getExams(organizationId: string, courseId: string) {
    return this.examModel.find({ organizationId, courseId, isDeleted: false });
  }

  async getExamById(organizationId: string, examId: string) {
    const exam = await this.examModel.findOne({ _id: examId, organizationId, isDeleted: false });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async publishExam(organizationId: string, examId: string) {
    const exam = await this.examModel.findOneAndUpdate(
      { _id: examId, organizationId },
      { $set: { status: 'PUBLISHED' } },
      { new: true }
    );
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async addQuestion(organizationId: string, examId: string, questionData: any) {
    const question = new this.questionModel({
      ...questionData,
      organizationId,
      examId,
    });
    return question.save();
  }

  async saveAnswer(organizationId: string, studentId: string, examId: string, answer: any) {
    const attempt = await this.attemptModel.findOne({ examId, studentId, organizationId, status: 'IN_PROGRESS' });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Attempt is not in progress');

    const existingIndex = attempt.answers.findIndex(a => a.questionId.toString() === answer.questionId);
    if (existingIndex >= 0) {
      attempt.answers[existingIndex] = {
        ...attempt.answers[existingIndex],
        ...answer,
      };
    } else {
      attempt.answers.push(answer);
    }

    await attempt.save();
    return { message: 'Answer saved successfully', attemptId: attempt._id };
  }

  async getQuestions(organizationId: string, examId: string, role?: string) {
    let query = this.questionModel.find({ organizationId, examId, isDeleted: false }).sort({ orderIndex: 1 });
    if (role === 'STUDENT') {
      query = query.select({ 'options.isCorrect': 0 });
    }
    return query.exec();
  }

  async updateQuestion(organizationId: string, examId: string, questionId: string, updateData: any) {
    const question = await this.questionModel.findOneAndUpdate(
      { _id: questionId, examId, organizationId, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  async deleteQuestion(organizationId: string, examId: string, questionId: string) {
    const question = await this.questionModel.findOneAndUpdate(
      { _id: questionId, examId, organizationId },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!question) throw new NotFoundException('Question not found');
    return { message: 'Question deleted successfully' };
  }

  async startAttempt(organizationId: string, studentId: string, examId: string) {
    const exam = await this.getExamById(organizationId, examId);
    if (exam.status !== 'PUBLISHED') throw new BadRequestException('Exam is not published');

    const existingInProgress = await this.attemptModel.findOne({ examId, studentId, organizationId, status: 'IN_PROGRESS' });
    if (existingInProgress) {
      return existingInProgress; // Resume active attempt
    }

    const completedAttempts = await this.attemptModel.countDocuments({ examId, studentId, organizationId, status: { $ne: 'IN_PROGRESS' } });
    const maxAttempts = exam.maxAttempts ?? 1;
    if (completedAttempts >= maxAttempts) {
      throw new BadRequestException('Exam already attempted maximum times');
    }

    const attemptNumber = completedAttempts + 1;
    const attempt = new this.attemptModel({
      organizationId,
      examId,
      studentId,
      totalMarks: exam.totalMarks,
      answers: [],
      attemptNumber,
    });

    await attempt.save();

    // Schedule auto-submit based on exam duration
    const delayMs = exam.durationMinutes * 60 * 1000;
    await this.examsQueue.add('autoSubmit', { attemptId: attempt._id }, { delay: delayMs });

    return attempt;
  }

  async submitAttempt(organizationId: string, studentId: string, examId: string, answers: any[]) {
    const attempt = await this.attemptModel.findOne({ examId, studentId, organizationId, status: 'IN_PROGRESS' });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Attempt already submitted');

    const exam = await this.getExamById(organizationId, examId);
    const questions = await this.questionModel.find({ examId, organizationId, isDeleted: false });

    const savedAnswers = attempt.answers || [];
    let mergedAnswers = savedAnswers;
    if (answers && answers.length) {
      const answerMap = new Map<string, any>();
      savedAnswers.forEach(answer => answerMap.set(answer.questionId.toString(), answer));
      answers.forEach(answer => {
        const existing = answerMap.get(answer.questionId) || {};
        answerMap.set(answer.questionId, {
          questionId: answer.questionId,
          selectedOption: answer.selectedOption,
          textAnswer: answer.textAnswer,
          isCorrect: existing.isCorrect || false,
          marks: existing.marks ?? 0,
          isGraded: existing.isGraded || false,
        });
      });
      mergedAnswers = Array.from(answerMap.values());
    }

    let marksObtained = 0;
    const evaluatedAnswers = mergedAnswers.map(answer => {
      const question = questions.find(q => q._id.toString() === String(answer.questionId));
      if (!question) return answer;

      let isCorrect = false;
      let answerMarks = typeof answer.marks === 'number' ? answer.marks : 0;
      if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
        const correctOption = question.options.find(opt => opt.isCorrect);
        if (correctOption && correctOption.text === answer.selectedOption) {
          isCorrect = true;
          answerMarks = question.marks;
          marksObtained += answerMarks;
        }
      } else {
        // manual grading required for short answer
      }
      
      return {
        questionId: answer.questionId,
        selectedOption: answer.selectedOption,
        textAnswer: answer.textAnswer,
        isCorrect,
        marks: answerMarks,
        isGraded: isCorrect ? true : answer.isGraded,
      };
    });

    const percentage = (marksObtained / exam.totalMarks) * 100;
    const isPassed = percentage >= exam.passingPercentage;

    attempt.answers = evaluatedAnswers;
    attempt.marksObtained = marksObtained;
    attempt.percentage = percentage;
    attempt.isPassed = isPassed;
    attempt.status = 'SUBMITTED';
    attempt.submittedAt = new Date();

    await attempt.save();

    const result = new this.resultModel({
      organizationId,
      studentId,
      courseId: exam.courseId,
      examId,
      attemptId: attempt._id,
      marksObtained,
      totalMarks: exam.totalMarks,
      percentage,
      isPassed,
    });
    
    await result.save();

    return { message: 'Exam submitted successfully', attemptId: attempt._id };
  }

  async getMyResult(organizationId: string, studentId: string, examId: string) {
    const result = await this.resultModel
      .findOne({ organizationId, studentId, examId, isPublished: true })
      .sort({ publishedAt: -1 });
    if (!result) throw new NotFoundException('Result not found');
    return result;
  }

  async getAttemptHistory(organizationId: string, studentId: string, examId: string) {
    return this.attemptModel
      .find({ organizationId, studentId, examId })
      .sort({ attemptNumber: 1, createdAt: 1 });
  }

  async getExamResults(organizationId: string, examId: string) {
    return this.resultModel.find({ organizationId, examId }).populate('studentId', 'fullName email');
  }

  async getShortAnswers(organizationId: string, examId: string, attemptId: string) {
    const attempt = await this.attemptModel.findOne({ _id: attemptId, examId, organizationId });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const questionIds = attempt.answers.map(a => a.questionId);
    const questions = await this.questionModel.find({ _id: { $in: questionIds } });

    const shortAnswers = attempt.answers
      .filter(a => a.textAnswer !== undefined && a.textAnswer !== null)
      .map(a => {
        const q = questions.find(qt => qt._id.toString() === a.questionId.toString());
        return {
          questionId: a.questionId,
          questionText: q ? q.questionText : null,
          textAnswer: a.textAnswer,
          selectedOption: a.selectedOption,
          isGraded: a.isGraded || false,
          marks: a.marks || 0,
        };
      });

    return shortAnswers;
  }

  async gradeShortAnswer(organizationId: string, graderId: string, examId: string, attemptId: string, questionId: string, marks: number) {
    const attempt = await this.attemptModel.findOne({ _id: attemptId, examId, organizationId });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const answerIndex = attempt.answers.findIndex(a => a.questionId.toString() === questionId.toString());
    if (answerIndex < 0) throw new NotFoundException('Answer not found');

    attempt.answers[answerIndex].marks = marks;
    attempt.answers[answerIndex].isGraded = true;

    // Recompute marksObtained: start with non-short-answer marks (already evaluated earlier)
    let marksObtained = 0;
    for (const a of attempt.answers) {
      if ((a.isCorrect || a.isGraded) && typeof a.marks === 'number') {
        marksObtained += a.marks;
      }
    }

    const exam = await this.getExamById(organizationId, examId);
    const percentage = (marksObtained / exam.totalMarks) * 100;
    const isPassed = percentage >= exam.passingPercentage;

    attempt.marksObtained = marksObtained;
    attempt.percentage = percentage;
    attempt.isPassed = isPassed;
    await attempt.save();

    // update or create result for this attempt
    const existingResult = await this.resultModel.findOne({ attemptId: attempt._id });
    if (existingResult) {
      existingResult.marksObtained = marksObtained;
      existingResult.percentage = percentage;
      existingResult.isPassed = isPassed;
      await existingResult.save();
    } else {
      const result = new this.resultModel({
        organizationId,
        studentId: attempt.studentId,
        courseId: exam.courseId,
        examId,
        attemptId: attempt._id,
        marksObtained,
        totalMarks: exam.totalMarks,
        percentage,
        isPassed,
      });
      await result.save();
    }

    // Notify student that their short-answer has been graded
    try {
      await this.notificationsService.createNotification(
        organizationId,
        attempt.studentId.toString(),
        'Exam answer graded',
        `Your answer for exam ${exam.title || exam._id} has been graded. Marks: ${marksObtained}`,
        'GRADING',
        `/courses/${exam.courseId}/exams/${examId}/attempts/${attempt._id}`
      );
    } catch (e) {
      // ignore notification failures
    }

    return { message: 'Answer graded', marksObtained, percentage, isPassed };
  }

  async publishResult(organizationId: string, resultId: string, gradedBy: string) {
    const result = await this.resultModel.findOneAndUpdate(
      { _id: resultId, organizationId },
      { $set: { isPublished: true, publishedAt: new Date(), gradedBy } },
      { new: true }
    );
    if (!result) throw new NotFoundException('Result not found');
    // Notify student about published result
    try {
      await this.notificationsService.createNotification(
        organizationId,
        result.studentId.toString(),
        'Result published',
        `Your result for exam ${result.examId} has been published. Marks: ${result.marksObtained}`,
        'RESULT',
        `/courses/${result.courseId}/exams/${result.examId}/results/${result._id}`
      );
    } catch (e) {}

    return result;
  }
}
