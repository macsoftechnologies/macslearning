import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseModule } from './entities/courseModule.entity';
import { Lesson } from './entities/lesson.entity';
import { LessonCheckpoint } from './entities/lessonCheckpoint.entity';
import { LessonProgress } from '../progress/entities/lessonProgress.entity';
import { LessonCheckpointAnswer } from './entities/lessonCheckpointAnswer.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { VideoQuiz } from './entities/video-quiz.entity';
import { VideoQuizAnswer } from './entities/video-quiz-answer.entity';
import { Course } from '../courses/entities/course.entity';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(CourseModule)
    private moduleRepository: Repository<CourseModule>,
    @InjectRepository(Lesson) private lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonCheckpoint)
    private checkpointRepository: Repository<LessonCheckpoint>,
    @InjectRepository(LessonProgress)
    private progressRepository: Repository<LessonProgress>,
    @InjectRepository(LessonCheckpointAnswer)
    private checkpointAnswerRepository: Repository<LessonCheckpointAnswer>,
    @InjectRepository(VideoQuiz)
    private videoQuizRepository: Repository<VideoQuiz>,
    @InjectRepository(VideoQuizAnswer)
    private videoQuizAnswerRepository: Repository<VideoQuizAnswer>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    private notificationsService: NotificationsService,
  ) {}

  async createModule(
    organizationId: string,
    courseId: string,
    moduleData: any,
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    const contentStatus = course?.status === 'PUBLISHED' ? 'IN_REVIEW' : 'PUBLISHED';

    const courseModule = this.moduleRepository.create({
      ...moduleData,
      organizationId,
      courseId,
      contentStatus,
      orderIndex: moduleData.orderIndex ?? moduleData.order,
    });
    return this.moduleRepository.save(courseModule);
  }

  async getModules(courseId: string, organizationId: string, userType?: string) {
    const whereClause: any = { courseId, organizationId, isDeleted: false };
    if (userType === 'STUDENT') {
      whereClause.contentStatus = 'PUBLISHED';
    }
    return this.moduleRepository.find({
      where: whereClause,
      order: { orderIndex: 'ASC' },
    });
  }

  async createLesson(
    organizationId: string,
    courseId: string,
    moduleId: string,
    lessonData: any,
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    const contentStatus = course?.status === 'PUBLISHED' ? 'IN_REVIEW' : 'PUBLISHED';

    const lesson = this.lessonRepository.create({
      ...lessonData,
      organizationId,
      courseId,
      moduleId,
      contentStatus,
      orderIndex: lessonData.orderIndex ?? lessonData.order,
    });
    return this.lessonRepository.save(lesson);
  }

  async getLessons(courseId: string, moduleId: string, organizationId: string, userType?: string) {
    const whereClause: any = { courseId, moduleId, organizationId, isDeleted: false };
    if (userType === 'STUDENT') {
      whereClause.contentStatus = 'PUBLISHED';
    }
    return this.lessonRepository.find({
      where: whereClause,
      order: { orderIndex: 'ASC' },
    });
  }

  async updateModule(
    organizationId: string,
    courseId: string,
    moduleId: string,
    updateData: any,
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    if (course?.status === 'PUBLISHED' && !updateData.contentStatus) {
      updateData.contentStatus = 'IN_REVIEW';
    }
    
    await this.moduleRepository.update(
      { id: moduleId, courseId, organizationId, isDeleted: false },
      updateData,
    );
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId, courseId, organizationId, isDeleted: false },
    });
    if (!module) throw new NotFoundException('Module not found');
    return module;
  }

  async deleteModule(
    organizationId: string,
    courseId: string,
    moduleId: string,
  ) {
    await this.moduleRepository.update(
      { id: moduleId, courseId, organizationId, isDeleted: false },
      { isDeleted: true },
    );
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId, courseId, organizationId, isDeleted: true },
    });
    if (!module) throw new NotFoundException('Module not found');
    return module;
  }

  async updateLesson(
    organizationId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    updateData: any,
  ) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    if (course?.status === 'PUBLISHED' && !updateData.contentStatus) {
      updateData.contentStatus = 'IN_REVIEW';
    }

    await this.lessonRepository.update(
      { id: lessonId, moduleId, courseId, organizationId, isDeleted: false },
      updateData,
    );
    const lesson = await this.lessonRepository.findOne({
      where: {
        id: lessonId,
        moduleId,
        courseId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async deleteLesson(
    organizationId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
  ) {
    await this.lessonRepository.update(
      { id: lessonId, moduleId, courseId, organizationId, isDeleted: false },
      { isDeleted: true },
    );
    const lesson = await this.lessonRepository.findOne({
      where: {
        id: lessonId,
        moduleId,
        courseId,
        organizationId,
        isDeleted: true,
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async createLessonCheckpoint(
    organizationId: string,
    courseId: string,
    lessonId: string,
    dto: any,
  ) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, organizationId, courseId, isDeleted: false },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const checkpoint = this.checkpointRepository.create({
      ...dto,
      organizationId,
      lessonId,
      courseId,
      moduleId: lesson.moduleId,
    });
    return this.checkpointRepository.save(checkpoint);
  }

  async getLessonCheckpoints(
    organizationId: string,
    courseId: string,
    lessonId: string,
  ) {
    return this.checkpointRepository.find({
      where: { organizationId, courseId, lessonId, isDeleted: false },
      order: { timestampSeconds: 'ASC' },
    });
  }

  async answerLessonCheckpoint(
    organizationId: string,
    studentId: string,
    courseId: string,
    lessonId: string,
    checkpointId: string,
    answer: any,
  ) {
    const checkpoint = await this.checkpointRepository.findOne({
      where: {
        id: checkpointId,
        organizationId,
        lessonId,
        courseId,
        isDeleted: false,
      },
    });
    if (!checkpoint) throw new NotFoundException('Checkpoint not found');

    // Simple validation for MCQ/TRUE_FALSE
    let isCorrect = false;
    if (
      (checkpoint.type === 'MCQ' || checkpoint.type === 'TRUE_FALSE') &&
      checkpoint.options
    ) {
      const correctOpt = checkpoint.options.find((o: any) => o.isCorrect);
      if (correctOpt && correctOpt.text === answer.selectedOption)
        isCorrect = true;
    }

    // Store the student's answer (for both MCQ and SHORT_ANSWER). Short answers are stored for manual grading.
    const answerDoc = this.checkpointAnswerRepository.create({
      organizationId,
      courseId,
      lessonId,
      checkpointId,
      studentId,
      selectedOption: answer.selectedOption,
      textAnswer: answer.textAnswer,
      isGraded: false,
    });
    await this.checkpointAnswerRepository.save(answerDoc);

    // If auto-graded and correct (MCQ/TRUE_FALSE), mark progress pass
    if (
      (checkpoint.type === 'MCQ' || checkpoint.type === 'TRUE_FALSE') &&
      isCorrect
    ) {
      let progress = await this.progressRepository.findOne({
        where: { organizationId, studentId, courseId, lessonId },
      });
      if (!progress) {
        progress = this.progressRepository.create({
          organizationId,
          studentId,
          courseId,
          lessonId,
          checkpointPassedIds: [checkpoint.id],
          lastAccessedAt: new Date(),
        });
      } else {
        progress.lastAccessedAt = new Date();
        const existingPassed = progress.checkpointPassedIds || [];
        if (!existingPassed.includes(checkpoint.id)) {
          progress.checkpointPassedIds = [...existingPassed, checkpoint.id];
        }
      }
      await this.progressRepository.save(progress);
    }

    return {
      accepted: !checkpoint.required || isCorrect,
      isCorrect,
      storedAnswerId: answerDoc.id,
    };
  }

  async getUngradedCheckpointAnswers(
    organizationId: string,
    checkpointId: string,
  ) {
    return this.checkpointAnswerRepository.find({
      where: { organizationId, checkpointId, isGraded: false },
      order: { createdAt: 'ASC' },
    });
  }

  async gradeCheckpointAnswer(
    organizationId: string,
    graderId: string,
    answerId: string,
    marks: number,
  ) {
    await this.checkpointAnswerRepository.update(
      { id: answerId, organizationId },
      { isGraded: true, marks, gradedBy: graderId, gradedAt: new Date() },
    );
    const ans = await this.checkpointAnswerRepository.findOne({
      where: { id: answerId, organizationId },
    });
    if (!ans) throw new NotFoundException('Answer not found');

    // If passing marks, add checkpoint to progress
    if (marks > 0) {
      let progress = await this.progressRepository.findOne({
        where: {
          organizationId,
          studentId: ans.studentId,
          courseId: ans.courseId,
          lessonId: ans.lessonId,
        },
      });
      if (!progress) {
        progress = this.progressRepository.create({
          organizationId,
          studentId: ans.studentId,
          courseId: ans.courseId,
          lessonId: ans.lessonId,
          checkpointPassedIds: [ans.checkpointId],
          lastAccessedAt: new Date(),
        });
      } else {
        progress.lastAccessedAt = new Date();
        const existingPassed = progress.checkpointPassedIds || [];
        if (!existingPassed.includes(ans.checkpointId)) {
          progress.checkpointPassedIds = [...existingPassed, ans.checkpointId];
        }
      }
      await this.progressRepository.save(progress);
    }

    // Notify student that their checkpoint answer was graded
    try {
      await this.notificationsService.createNotification(
        ans.organizationId,
        ans.studentId,
        'Checkpoint graded',
        `Your answer to checkpoint in lesson ${ans.lessonId} has been graded. Marks: ${marks}`,
        'GRADING',
        `/courses/${ans.courseId}/lessons/${ans.lessonId}`,
      );
    } catch (e) {
      // don't fail grading if notification fails
    }

    return ans;
  }

  async createVideoQuiz(
    organizationId: string,
    courseId: string,
    lessonId: string,
    quizData: any,
  ) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, organizationId, courseId, isDeleted: false },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const quiz = this.videoQuizRepository.create({
      ...quizData,
      organizationId,
      courseId,
      lessonId,
    });
    return this.videoQuizRepository.save(quiz);
  }

  async getVideoQuizzes(
    organizationId: string,
    courseId: string,
    lessonId: string,
  ) {
    return this.videoQuizRepository.find({
      where: { organizationId, courseId, lessonId },
      order: { timestampSeconds: 'ASC' },
    });
  }

  async deleteVideoQuiz(
    organizationId: string,
    courseId: string,
    lessonId: string,
    quizId: string,
  ) {
    const quiz = await this.videoQuizRepository.findOne({
      where: { id: quizId, organizationId, courseId, lessonId },
    });
    if (!quiz) throw new NotFoundException('Video Quiz not found');
    await this.videoQuizRepository.delete({
      id: quizId,
      organizationId,
      courseId,
      lessonId,
    });
    return quiz;
  }

  async submitVideoQuizAnswer(
    organizationId: string,
    studentId: string,
    courseId: string,
    lessonId: string,
    quizId: string,
    answer: any,
  ) {
    const quiz = await this.videoQuizRepository.findOne({
      where: { id: quizId, organizationId, courseId, lessonId },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    let isCorrect = false;
    let isGraded = false;
    let marks = 0;

    if (quiz.type === 'MCQ' || quiz.type === 'TRUE_FALSE') {
      isGraded = true;
      if (quiz.options) {
        const correctOpt = quiz.options.find((o: any) => o.isCorrect);
        if (correctOpt && correctOpt.text === answer.selectedOption) {
          isCorrect = true;
          marks = quiz.maxMarks || 1;
        }
      }
    }

    let answerDoc = await this.videoQuizAnswerRepository.findOne({
      where: { organizationId, studentId, quizId },
    });
    if (!answerDoc) {
      answerDoc = this.videoQuizAnswerRepository.create({
        organizationId,
        courseId,
        lessonId,
        quizId,
        studentId,
        selectedOption: answer.selectedOption,
        textAnswer: answer.textAnswer,
        isCorrect,
        isGraded,
        marks,
      });
    } else {
      answerDoc.selectedOption = answer.selectedOption;
      answerDoc.textAnswer = answer.textAnswer;
      answerDoc.isCorrect = isCorrect;
      answerDoc.isGraded = isGraded;
      answerDoc.marks = marks;
    }

    return this.videoQuizAnswerRepository.save(answerDoc);
  }

  async getVideoQuizAnswers(
    organizationId: string,
    courseId: string,
    lessonId: string,
  ) {
    const answers = await this.videoQuizAnswerRepository
      .createQueryBuilder('ans')
      .leftJoin('users', 'u', 'u.id = ans.studentId')
      .leftJoin('videoquizs', 'vq', 'vq.id = ans.quizId')
      .where('ans.organizationId = :organizationId', { organizationId })
      .andWhere('ans.courseId = :courseId', { courseId })
      .andWhere('ans.lessonId = :lessonId', { lessonId })
      .select([
        'ans.*',
        'u.id as student_id',
        'u.fullName as student_fullName',
        'u.email as student_email',
        'vq.id as quiz_id',
        'vq.questionText as quiz_questionText',
        'vq.type as quiz_type',
        'vq.maxMarks as quiz_maxMarks',
        'vq.options as quiz_options',
        'vq.correctAnswer as quiz_correctAnswer',
        'vq.timestampSeconds as quiz_timestampSeconds',
      ])
      .orderBy('ans.createdAt', 'DESC')
      .getRawMany();

    return answers.map((a) => ({
      ...a,
      studentId: {
        _id: a.student_id,
        id: a.student_id,
        fullName: a.student_fullName,
        email: a.student_email,
      },
      quizId: {
        _id: a.quiz_id,
        id: a.quiz_id,
        questionText: a.quiz_questionText,
        type: a.quiz_type,
        maxMarks: a.quiz_maxMarks,
        options:
          typeof a.quiz_options === 'string'
            ? JSON.parse(a.quiz_options)
            : a.quiz_options,
        correctAnswer: a.quiz_correctAnswer,
        timestampSeconds: a.quiz_timestampSeconds,
      },
    }));
  }

  async getMyVideoQuizAnswers(
    organizationId: string,
    studentId: string,
    courseId: string,
    lessonId: string,
  ) {
    const answers = await this.videoQuizAnswerRepository
      .createQueryBuilder('ans')
      .leftJoin('videoquizs', 'vq', 'vq.id = ans.quizId')
      .where('ans.organizationId = :organizationId', { organizationId })
      .andWhere('ans.studentId = :studentId', { studentId })
      .andWhere('ans.courseId = :courseId', { courseId })
      .andWhere('ans.lessonId = :lessonId', { lessonId })
      .select([
        'ans.*',
        'vq.id as quiz_id',
        'vq.questionText as quiz_questionText',
        'vq.type as quiz_type',
        'vq.maxMarks as quiz_maxMarks',
        'vq.options as quiz_options',
        'vq.correctAnswer as quiz_correctAnswer',
        'vq.timestampSeconds as quiz_timestampSeconds',
      ])
      .orderBy('ans.createdAt', 'ASC')
      .getRawMany();

    return answers.map((a) => ({
      ...a,
      quizId: {
        _id: a.quiz_id,
        id: a.quiz_id,
        questionText: a.quiz_questionText,
        type: a.quiz_type,
        maxMarks: a.quiz_maxMarks,
        options:
          typeof a.quiz_options === 'string'
            ? JSON.parse(a.quiz_options)
            : a.quiz_options,
        correctAnswer: a.quiz_correctAnswer,
        timestampSeconds: a.quiz_timestampSeconds,
      },
    }));
  }

  async gradeVideoQuizAnswer(
    organizationId: string,
    graderId: string,
    answerId: string,
    marks: number,
  ) {
    await this.videoQuizAnswerRepository.update(
      { id: answerId, organizationId },
      { isGraded: true, marks, gradedBy: graderId, gradedAt: new Date() },
    );
    const ans = await this.videoQuizAnswerRepository.findOne({
      where: { id: answerId, organizationId },
    });
    if (!ans) throw new NotFoundException('Answer not found');
    return ans;
  }
}
