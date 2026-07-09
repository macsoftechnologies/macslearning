import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Exam } from './entities/exam.entity';
import { Question } from './entities/question.entity';
import { Attempt } from './entities/attempt.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam) private examRepository: Repository<Exam>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Attempt) private attemptRepository: Repository<Attempt>,
    @InjectRepository(AssessmentResult)
    private resultRepository: Repository<AssessmentResult>,
    @InjectQueue('exams') private examsQueue: Queue,
    private notificationsService: NotificationsService,
  ) {}

  async createExam(
    organizationId: string,
    courseId: string,
    createdBy: string,
    examData: any,
  ) {
    const exam = this.examRepository.create({
      ...examData,
      organizationId,
      courseId,
      createdBy,
    });
    return this.examRepository.save(exam);
  }

  async getExams(organizationId: string, courseId: string) {
    return this.examRepository.find({
      where: { organizationId, courseId, isDeleted: false },
    });
  }

  async getExamById(organizationId: string, examId: string) {
    const exam = await this.examRepository.findOne({
      where: { id: examId, organizationId, isDeleted: false },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async publishExam(organizationId: string, examId: string) {
    await this.examRepository.update(
      { id: examId, organizationId },
      { status: 'PUBLISHED' },
    );
    const exam = await this.examRepository.findOne({
      where: { id: examId, organizationId },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async addQuestion(organizationId: string, examId: string, questionData: any) {
    const question = this.questionRepository.create({
      ...questionData,
      organizationId,
      examId,
    });
    return this.questionRepository.save(question);
  }

  async saveAnswer(
    organizationId: string,
    studentId: string,
    examId: string,
    answer: any,
  ) {
    const attempt = await this.attemptRepository.findOne({
      where: { examId, studentId, organizationId, status: 'IN_PROGRESS' },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'IN_PROGRESS')
      throw new BadRequestException('Attempt is not in progress');

    let answers: any[] = attempt.answers || [];
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch (e) {
        answers = [];
      }
    }

    const existingIndex = answers.findIndex(
      (a) => String(a.questionId) === String(answer.questionId),
    );
    if (existingIndex >= 0) {
      answers[existingIndex] = {
        ...answers[existingIndex],
        ...answer,
      };
    } else {
      answers.push(answer);
    }

    attempt.answers = answers;
    await this.attemptRepository.save(attempt);

    return { message: 'Answer saved successfully', attemptId: attempt.id };
  }

  async getQuestions(organizationId: string, examId: string, role?: string) {
    const questions = await this.questionRepository.find({
      where: { organizationId, examId, isDeleted: false },
      order: { orderIndex: 'ASC' },
    });

    if (role === 'STUDENT') {
      return questions.map((q) => {
        const mapped = { ...q };
        if (mapped.options) {
          let opts = mapped.options;
          if (typeof opts === 'string') opts = JSON.parse(opts);
          mapped.options = opts.map((o) => ({ text: o.text, id: o.id }));
        }
        delete (mapped as any).correctAnswer;
        return mapped;
      });
    }
    return questions;
  }

  async updateQuestion(
    organizationId: string,
    examId: string,
    questionId: string,
    updateData: any,
  ) {
    await this.questionRepository.update(
      { id: questionId, examId, organizationId, isDeleted: false },
      updateData,
    );
    const question = await this.questionRepository.findOne({
      where: { id: questionId, examId, organizationId, isDeleted: false },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  async deleteQuestion(
    organizationId: string,
    examId: string,
    questionId: string,
  ) {
    await this.questionRepository.update(
      { id: questionId, examId, organizationId },
      { isDeleted: true },
    );
    const question = await this.questionRepository.findOne({
      where: { id: questionId, examId, organizationId, isDeleted: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    return { message: 'Question deleted successfully' };
  }

  async startAttempt(
    organizationId: string,
    studentId: string,
    examId: string,
  ) {
    const exam = await this.getExamById(organizationId, examId);
    if (exam.status !== 'PUBLISHED')
      throw new BadRequestException('Exam is not published');

    const existingInProgress = await this.attemptRepository.findOne({
      where: { examId, studentId, organizationId, status: 'IN_PROGRESS' },
    });
    if (existingInProgress) {
      return existingInProgress; // Resume active attempt
    }

    const completedAttempts = await this.attemptRepository
      .createQueryBuilder('attempt')
      .where('attempt.examId = :examId', { examId })
      .andWhere('attempt.studentId = :studentId', { studentId })
      .andWhere('attempt.organizationId = :organizationId', { organizationId })
      .andWhere('attempt.status != :status', { status: 'IN_PROGRESS' })
      .getCount();

    const maxAttempts = exam.maxAttempts ?? 3;
    if (completedAttempts >= maxAttempts) {
      throw new BadRequestException('Exam already attempted maximum times');
    }

    const attemptNumber = completedAttempts + 1;
    const attempt = this.attemptRepository.create({
      organizationId,
      examId,
      studentId,
      totalMarks: exam.totalMarks,
      answers: [],
      attemptNumber,
    });

    await this.attemptRepository.save(attempt);

    // Schedule auto-submit based on exam duration
    const delayMs = (exam.durationMinutes || 60) * 60 * 1000;
    await this.examsQueue.add(
      'autoSubmit',
      { attemptId: attempt.id },
      { delay: delayMs },
    );

    return attempt;
  }

  async submitAttempt(
    organizationId: string,
    studentId: string,
    examId: string,
    answers: any[],
  ) {
    const attempt = await this.attemptRepository.findOne({
      where: { examId, studentId, organizationId, status: 'IN_PROGRESS' },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'IN_PROGRESS')
      throw new BadRequestException('Attempt already submitted');

    const exam = await this.getExamById(organizationId, examId);
    const questions = await this.questionRepository.find({
      where: { examId, organizationId, isDeleted: false },
    });

    let savedAnswers: any[] = attempt.answers || [];
    if (typeof savedAnswers === 'string') {
      try {
        savedAnswers = JSON.parse(savedAnswers);
      } catch (e) {
        savedAnswers = [];
      }
    }

    let mergedAnswers = savedAnswers;
    if (answers && answers.length) {
      const answerMap = new Map<string, any>();
      savedAnswers.forEach((answer) =>
        answerMap.set(String(answer.questionId), answer),
      );
      answers.forEach((answer) => {
        const existing = answerMap.get(String(answer.questionId)) || {};
        answerMap.set(String(answer.questionId), {
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
    const evaluatedAnswers = mergedAnswers.map((answer) => {
      const question = questions.find(
        (q) => String(q.id) === String(answer.questionId),
      );
      if (!question) return answer;

      let isCorrect = false;
      let answerMarks = typeof answer.marks === 'number' ? answer.marks : 0;

      let qOptions = question.options;
      if (typeof qOptions === 'string')
        try {
          qOptions = JSON.parse(qOptions);
        } catch (e) {
          qOptions = [];
        }

      if (question.type === 'MCQ') {
        const correctOption = (qOptions || []).find(
          (opt: any) => opt.isCorrect,
        );
        if (
          correctOption &&
          (correctOption.text === answer.selectedOption ||
            String(correctOption.id) === String(answer.selectedOption))
        ) {
          isCorrect = true;
          answerMarks = question.marks || 1;
          marksObtained += answerMarks;
        }
      } else if (question.type === 'TRUE_FALSE') {
        if (
          question.correctAnswer &&
          question.correctAnswer.toLowerCase() ===
            (answer.selectedOption || '').toLowerCase()
        ) {
          isCorrect = true;
          answerMarks = question.marks || 1;
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

    const totalMarks = exam.totalMarks || 100;
    const percentage = (marksObtained / totalMarks) * 100;
    const isPassed = percentage >= (exam.passingPercentage || 0);

    attempt.answers = evaluatedAnswers;
    attempt.status = 'SUBMITTED';
    attempt.submittedAt = new Date();
    attempt.marksObtained = marksObtained;
    attempt.percentage = percentage;
    attempt.isPassed = isPassed;

    await this.attemptRepository.save(attempt);

    let result = await this.resultRepository.findOne({
      where: { examId, studentId, organizationId },
    });
    if (result) {
      result.attemptId = attempt.id;
      result.marksObtained = marksObtained;
      result.totalMarks = totalMarks;
      result.percentage = percentage;
      result.isPassed = isPassed;
    } else {
      result = this.resultRepository.create({
        organizationId,
        studentId,
        courseId: exam.courseId,
        examId,
        attemptId: attempt.id,
        marksObtained,
        totalMarks: totalMarks,
        percentage,
        isPassed,
      });
    }

    await this.resultRepository.save(result);

    return { message: 'Exam submitted successfully', attemptId: attempt.id };
  }

  async getMyResult(organizationId: string, studentId: string, examId: string) {
    const result = await this.resultRepository.findOne({
      where: { organizationId, studentId, examId, isPublished: true },
      order: { publishedAt: 'DESC' },
    });
    if (!result) throw new NotFoundException('Result not found');
    return result;
  }

  async getAttemptHistory(
    organizationId: string,
    studentId: string,
    examId: string,
  ) {
    return this.attemptRepository.find({
      where: { organizationId, studentId, examId },
      order: { attemptNumber: 'ASC', createdAt: 'ASC' },
    });
  }

  async getExamResults(organizationId: string, examId: string) {
    const results = await this.resultRepository
      .createQueryBuilder('result')
      .leftJoin(User, 'student', 'student.id = result.studentId')
      .where('result.organizationId = :organizationId', { organizationId })
      .andWhere('result.examId = :examId', { examId })
      .select([
        'result.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
      ])
      .getRawMany();

    return results.map((r) => ({
      ...r,
      studentId: {
        _id: r.student_id,
        id: r.student_id,
        fullName: r.student_fullName,
        email: r.student_email,
      },
    }));
  }

  async getAttemptReview(
    organizationId: string,
    studentId: string,
    examId: string,
    attemptId: string,
  ) {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, examId, studentId, organizationId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'SUBMITTED')
      throw new BadRequestException('Attempt not yet submitted');

    const questions = await this.questionRepository.find({
      where: { examId, organizationId, isDeleted: false },
      order: { orderIndex: 'ASC' },
    });

    return { attempt, questions };
  }

  async getAttemptReviewForFaculty(
    organizationId: string,
    examId: string,
    attemptId: string,
  ) {
    const attemptRaw = await this.attemptRepository
      .createQueryBuilder('attempt')
      .leftJoin(User, 'student', 'student.id = attempt.studentId')
      .where('attempt.id = :attemptId', { attemptId })
      .andWhere('attempt.examId = :examId', { examId })
      .andWhere('attempt.organizationId = :organizationId', { organizationId })
      .select([
        'attempt.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
      ])
      .getRawOne();

    if (!attemptRaw) throw new NotFoundException('Attempt not found');

    const attempt = {
      ...attemptRaw,
      studentId: {
        _id: attemptRaw.student_id,
        id: attemptRaw.student_id,
        fullName: attemptRaw.student_fullName,
        email: attemptRaw.student_email,
      },
    };

    if (typeof attempt.answers === 'string') {
      try {
        attempt.answers = JSON.parse(attempt.answers);
      } catch (e) {
        attempt.answers = [];
      }
    }

    const questions = await this.questionRepository.find({
      where: { examId, organizationId, isDeleted: false },
      order: { orderIndex: 'ASC' },
    });

    return { attempt, questions };
  }

  async getShortAnswers(
    organizationId: string,
    examId: string,
    attemptId: string,
  ) {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, examId, organizationId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    let answers: any[] = attempt.answers || [];
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch (e) {
        answers = [];
      }
    }

    const questionIds = answers.map((a) => a.questionId).filter(Boolean);
    const questions =
      questionIds.length > 0
        ? await this.questionRepository
            .createQueryBuilder('question')
            .where('question.id IN (:...questionIds)', { questionIds })
            .getMany()
        : [];

    const shortAnswers = answers
      .filter((a) => a.textAnswer !== undefined && a.textAnswer !== null)
      .map((a) => {
        const q = questions.find(
          (qt) => String(qt.id) === String(a.questionId),
        );
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

  async gradeShortAnswer(
    organizationId: string,
    graderId: string,
    examId: string,
    attemptId: string,
    questionId: string,
    marks: number,
  ) {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, examId, organizationId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    let answers: any[] = attempt.answers || [];
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch (e) {
        answers = [];
      }
    }

    const answerIndex = answers.findIndex(
      (a) => String(a.questionId) === String(questionId),
    );
    if (answerIndex < 0) throw new NotFoundException('Answer not found');

    answers[answerIndex].marks = marks;
    answers[answerIndex].isGraded = true;
    attempt.answers = answers;

    // Recompute marksObtained
    let marksObtained = 0;
    for (const a of answers) {
      if ((a.isCorrect || a.isGraded) && typeof a.marks === 'number') {
        marksObtained += a.marks;
      }
    }

    const exam = await this.getExamById(organizationId, examId);
    const percentage = (marksObtained / (exam.totalMarks || 100)) * 100;
    const isPassed = percentage >= (exam.passingPercentage || 0);

    attempt.marksObtained = marksObtained;
    attempt.percentage = percentage;
    attempt.isPassed = isPassed;

    await this.attemptRepository.save(attempt);

    // update or create result for this attempt
    const existingResult = await this.resultRepository.findOne({
      where: { examId, studentId: attempt.studentId, organizationId },
    });
    if (existingResult) {
      existingResult.attemptId = attempt.id;
      existingResult.marksObtained = marksObtained;
      existingResult.percentage = percentage;
      existingResult.isPassed = isPassed;
      await this.resultRepository.save(existingResult);
    } else {
      const result = this.resultRepository.create({
        organizationId,
        studentId: attempt.studentId,
        courseId: exam.courseId,
        examId,
        attemptId: attempt.id,
        marksObtained,
        totalMarks: exam.totalMarks,
        percentage,
        isPassed,
      });
      await this.resultRepository.save(result);
    }

    // Notify student that their short-answer has been graded
    try {
      await this.notificationsService.createNotification(
        organizationId,
        attempt.studentId,
        'Exam answer graded',
        `Your answer for exam ${exam.title || exam.id} has been graded. Marks: ${marksObtained}`,
        'GRADING',
        `/courses/${exam.courseId}/exams/${examId}/attempts/${attempt.id}`,
      );
    } catch (e) {}

    return { message: 'Answer graded', marksObtained, percentage, isPassed };
  }

  async publishResult(
    organizationId: string,
    resultId: string,
    gradedBy: string,
  ) {
    await this.resultRepository.update(
      { id: resultId, organizationId },
      { isPublished: true, publishedAt: new Date(), gradedBy },
    );
    const result = await this.resultRepository.findOne({
      where: { id: resultId, organizationId },
    });
    if (!result) throw new NotFoundException('Result not found');

    // Notify student about published result
    try {
      await this.notificationsService.createNotification(
        organizationId,
        result.studentId,
        'Result published',
        `Your result for exam ${result.examId} has been published. Marks: ${result.marksObtained}`,
        'RESULT',
        `/courses/${result.courseId}/exams/${result.examId}/results/${result.id}`,
      );
    } catch (e) {}

    return result;
  }
}
