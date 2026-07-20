import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentResult } from './entities/assessmentResult.entity';
import { Attempt } from '../exams/entities/attempt.entity';
import { VideoQuizAnswer } from '../content/entities/video-quiz-answer.entity';
import { Exam } from '../exams/entities/exam.entity';
import { Course } from '../courses/entities/course.entity';
import { VideoQuiz } from '../content/entities/video-quiz.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ResultsService {
  constructor(
    @InjectRepository(AssessmentResult)
    private resultRepository: Repository<AssessmentResult>,
    @InjectRepository(Attempt) private attemptRepository: Repository<Attempt>,
    @InjectRepository(VideoQuizAnswer)
    private videoQuizAnswerRepository: Repository<VideoQuizAnswer>,
  ) {}

  async getMyResults(organizationId: string, studentId: string) {
    const results = await this.resultRepository
      .createQueryBuilder('result')
      .leftJoin(Exam, 'exam', 'exam.id = result.examId')
      .leftJoin(Course, 'course', 'course.id = result.courseId')
      .where('result.organizationId = :organizationId', { organizationId })
      .andWhere('result.studentId = :studentId', { studentId })
      .andWhere('result.isPublished = :isPublished', { isPublished: true })
      .select([
        'result.*', 
        'exam.id as exam_id', 
        'exam.title as exam_title',
        'course.id as course_id',
        'course.title as course_title'
      ])
      .getRawMany();

    return results.map((r) => ({
      ...r,
      examId: { _id: r.exam_id, id: r.exam_id, title: r.exam_title },
      courseId: { _id: r.course_id, id: r.course_id, title: r.course_title },
    }));
  }

  async getMyAttempts(organizationId: string, studentId: string) {
    const attempts = await this.attemptRepository
      .createQueryBuilder('attempt')
      .leftJoin(Exam, 'exam', 'exam.id = attempt.examId')
      .leftJoin(Course, 'course', 'course.id = exam.courseId')
      .where('attempt.organizationId = :organizationId', { organizationId })
      .andWhere('attempt.studentId = :studentId', { studentId })
      .select([
        'attempt.*',
        'exam.id as exam_id',
        'exam.title as exam_title',
        'course.id as course_id',
      ])
      .orderBy('attempt.createdAt', 'DESC')
      .getRawMany();

    return attempts.map((a) => ({
      ...a,
      examId: {
        _id: a.exam_id,
        id: a.exam_id,
        title: a.exam_title,
        courseId: a.course_id,
      },
    }));
  }

  async getMyVideoQuizAnswers(organizationId: string, studentId: string) {
    const answers = await this.videoQuizAnswerRepository
      .createQueryBuilder('answer')
      .leftJoin(VideoQuiz, 'quiz', 'quiz.id = answer.quizId')
      .leftJoin(Lesson, 'lesson', 'lesson.id = answer.lessonId')
      .where('answer.organizationId = :organizationId', { organizationId })
      .andWhere('answer.studentId = :studentId', { studentId })
      .select([
        'answer.*',
        'quiz.id as quiz_id',
        'quiz.questionText as quiz_questionText',
        'quiz.type as quiz_type',
        'quiz.maxMarks as quiz_maxMarks',
        'lesson.id as lesson_id',
        'lesson.title as lesson_title',
      ])
      .orderBy('answer.createdAt', 'DESC')
      .getRawMany();

    return answers.map((a) => ({
      ...a,
      quizId: {
        _id: a.quiz_id,
        id: a.quiz_id,
        questionText: a.quiz_questionText,
        type: a.quiz_type,
        maxMarks: a.quiz_maxMarks,
      },
      lessonId: { _id: a.lesson_id, id: a.lesson_id, title: a.lesson_title },
    }));
  }

  async getCourseResults(organizationId: string, courseId: string) {
    const results = await this.resultRepository
      .createQueryBuilder('result')
      .leftJoin(User, 'student', 'student.id = result.studentId')
      .leftJoin(Exam, 'exam', 'exam.id = result.examId')
      .where('result.organizationId = :organizationId', { organizationId })
      .andWhere('result.courseId = :courseId', { courseId })
      .select([
        'result.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
        'exam.id as exam_id',
        'exam.title as exam_title',
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
      examId: { _id: r.exam_id, id: r.exam_id, title: r.exam_title },
    }));
  }
}
