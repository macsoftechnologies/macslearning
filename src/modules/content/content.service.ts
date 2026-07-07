import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CourseModule, CourseModuleDocument } from './schemas/courseModule.schema';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { LessonCheckpoint, LessonCheckpointDocument } from './schemas/lessonCheckpoint.schema';
import { LessonProgress, LessonProgressDocument } from '../progress/schemas/lessonProgress.schema';
import { LessonCheckpointAnswer, LessonCheckpointAnswerDocument } from './schemas/lessonCheckpointAnswer.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { VideoQuiz, VideoQuizDocument } from './schemas/video-quiz.schema';
import { VideoQuizAnswer, VideoQuizAnswerDocument } from './schemas/video-quiz-answer.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';

@Injectable()
export class ContentService {
  constructor(
    @InjectModel(CourseModule.name) private moduleModel: Model<CourseModuleDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    @InjectModel(LessonCheckpoint.name) private checkpointModel: Model<LessonCheckpointDocument>,
    @InjectModel(LessonProgress.name) private progressModel: Model<LessonProgressDocument>,
    @InjectModel('LessonCheckpointAnswer') private checkpointAnswerModel: Model<LessonCheckpointAnswerDocument>,
    @InjectModel(VideoQuiz.name) private videoQuizModel: Model<VideoQuizDocument>,
    @InjectModel(VideoQuizAnswer.name) private videoQuizAnswerModel: Model<VideoQuizAnswerDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    private notificationsService: NotificationsService,
  ) {}

  private async ensureCourseNotPublished(courseId: string, organizationId: string) {
    const course = await this.courseModel.findOne({ _id: courseId, organizationId });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot modify content of a published course.');
    }
  }

  async createModule(organizationId: string, courseId: string, moduleData: any) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const courseModule = new this.moduleModel({
      ...moduleData,
      organizationId,
      courseId,
      orderIndex: moduleData.orderIndex ?? moduleData.order,
    });
    return courseModule.save();
  }

  async getModules(courseId: string, organizationId: string) {
    return this.moduleModel.find({ courseId, organizationId, isDeleted: false }).sort({ orderIndex: 1 });
  }

  async createLesson(organizationId: string, courseId: string, moduleId: string, lessonData: any) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const lesson = new this.lessonModel({
      ...lessonData,
      organizationId,
      courseId,
      moduleId,
      orderIndex: lessonData.orderIndex ?? lessonData.order,
    });
    return lesson.save();
  }

  async getLessons(courseId: string, moduleId: string, organizationId: string) {
    return this.lessonModel.find({ courseId, moduleId, organizationId, isDeleted: false }).sort({ orderIndex: 1 });
  }

  async updateModule(organizationId: string, courseId: string, moduleId: string, updateData: any) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const module = await this.moduleModel.findOneAndUpdate(
      { _id: moduleId, courseId, organizationId, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
    if (!module) throw new NotFoundException('Module not found');
    return module;
  }

  async deleteModule(organizationId: string, courseId: string, moduleId: string) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const module = await this.moduleModel.findOneAndUpdate(
      { _id: moduleId, courseId, organizationId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!module) throw new NotFoundException('Module not found');
    return module;
  }

  async updateLesson(organizationId: string, courseId: string, moduleId: string, lessonId: string, updateData: any) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const lesson = await this.lessonModel.findOneAndUpdate(
      { _id: lessonId, moduleId, courseId, organizationId, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async deleteLesson(organizationId: string, courseId: string, moduleId: string, lessonId: string) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const lesson = await this.lessonModel.findOneAndUpdate(
      { _id: lessonId, moduleId, courseId, organizationId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async createLessonCheckpoint(organizationId: string, courseId: string, lessonId: string, dto: any) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const lesson = await this.lessonModel.findOne({ _id: lessonId, organizationId, courseId, isDeleted: false });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const checkpoint = new this.checkpointModel({
      ...dto,
      organizationId,
      lessonId,
      courseId,
      moduleId: lesson.moduleId,
    });
    return checkpoint.save();
  }

  async getLessonCheckpoints(organizationId: string, courseId: string, lessonId: string) {
    return this.checkpointModel.find({ organizationId, courseId, lessonId, isDeleted: false }).sort({ timestampSeconds: 1 });
  }

  async answerLessonCheckpoint(organizationId: string, studentId: string, courseId: string, lessonId: string, checkpointId: string, answer: any) {
    const checkpoint = await this.checkpointModel.findOne({ _id: checkpointId, organizationId, lessonId, courseId, isDeleted: false });
    if (!checkpoint) throw new NotFoundException('Checkpoint not found');

    // Simple validation for MCQ/TRUE_FALSE
    let isCorrect = false;
    if ((checkpoint.type === 'MCQ' || checkpoint.type === 'TRUE_FALSE') && checkpoint.options) {
      const correctOpt = checkpoint.options.find(o => o.isCorrect);
      if (correctOpt && correctOpt.text === answer.selectedOption) isCorrect = true;
    }

    // Store the student's answer (for both MCQ and SHORT_ANSWER). Short answers are stored for manual grading.
    const answerDoc = new this.checkpointAnswerModel({
      organizationId,
      courseId,
      lessonId,
      checkpointId,
      studentId,
      selectedOption: answer.selectedOption,
      textAnswer: answer.textAnswer,
      isGraded: false,
    });
    await answerDoc.save();

    // If auto-graded and correct (MCQ/TRUE_FALSE), mark progress pass
    if ((checkpoint.type === 'MCQ' || checkpoint.type === 'TRUE_FALSE') && isCorrect) {
      const progress = await this.progressModel.findOneAndUpdate(
        { organizationId, studentId, courseId, lessonId },
        { 
          $set: { lastAccessedAt: new Date() },
        },
        { new: true, upsert: true }
      );
      await this.progressModel.updateOne(
        { _id: progress._id },
        { $addToSet: { checkpointPassedIds: checkpoint._id } }
      );
    }

    return { accepted: !checkpoint.required || isCorrect, isCorrect, storedAnswerId: answerDoc._id };
  }

  async getUngradedCheckpointAnswers(organizationId: string, checkpointId: string) {
    return this.checkpointAnswerModel.find({ organizationId, checkpointId, isGraded: false }).sort({ createdAt: 1 });
  }

  async gradeCheckpointAnswer(organizationId: string, graderId: string, answerId: string, marks: number) {
    const ans = await this.checkpointAnswerModel.findOneAndUpdate(
      { _id: answerId, organizationId },
      { $set: { isGraded: true, marks, gradedBy: graderId, gradedAt: new Date() } },
      { new: true }
    );
    if (!ans) throw new NotFoundException('Answer not found');

    // If passing marks, add checkpoint to progress
    if (marks > 0) {
      await this.progressModel.findOneAndUpdate(
        { organizationId, studentId: ans.studentId, courseId: ans.courseId, lessonId: ans.lessonId },
        { $addToSet: { checkpointPassedIds: ans.checkpointId }, $set: { lastAccessedAt: new Date() } },
        { new: true, upsert: true }
      );
    }

    // Notify student that their checkpoint answer was graded
    try {
      await this.notificationsService.createNotification(
        ans.organizationId.toString(),
        ans.studentId.toString(),
        'Checkpoint graded',
        `Your answer to checkpoint in lesson ${ans.lessonId} has been graded. Marks: ${marks}`,
        'GRADING',
        `/courses/${ans.courseId}/lessons/${ans.lessonId}`
      );
    } catch (e) {
      // don't fail grading if notification fails
    }

    return ans;
  }

  async createVideoQuiz(organizationId: string, courseId: string, lessonId: string, quizData: any) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const lesson = await this.lessonModel.findOne({ _id: lessonId, organizationId, courseId, isDeleted: false });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const quiz = new this.videoQuizModel({
      ...quizData,
      organizationId,
      courseId,
      lessonId,
    });
    return quiz.save();
  }

  async getVideoQuizzes(organizationId: string, courseId: string, lessonId: string) {
    return this.videoQuizModel.find({ organizationId, courseId, lessonId }).sort({ timestampSeconds: 1 });
  }

  async deleteVideoQuiz(organizationId: string, courseId: string, lessonId: string, quizId: string) {
    await this.ensureCourseNotPublished(courseId, organizationId);
    const quiz = await this.videoQuizModel.findOneAndDelete({ _id: quizId, organizationId, courseId, lessonId });
    if (!quiz) throw new NotFoundException('Video Quiz not found');
    return quiz;
  }

  async submitVideoQuizAnswer(organizationId: string, studentId: string, courseId: string, lessonId: string, quizId: string, answer: any) {
    const quiz = await this.videoQuizModel.findOne({ _id: quizId, organizationId, courseId, lessonId });
    if (!quiz) throw new NotFoundException('Quiz not found');

    let isCorrect = false;
    let isGraded = false;
    let marks = 0;

    if (quiz.type === 'MCQ' || quiz.type === 'TRUE_FALSE') {
      isGraded = true;
      if (quiz.options) {
        const correctOpt = quiz.options.find(o => o.isCorrect);
        if (correctOpt && correctOpt.text === answer.selectedOption) {
          isCorrect = true;
          marks = quiz.maxMarks || 1;
        }
      }
    }

    const answerDoc = new this.videoQuizAnswerModel({
      organizationId,
      courseId,
      lessonId,
      quizId,
      studentId,
      selectedOption: answer.selectedOption,
      textAnswer: answer.textAnswer,
      isCorrect,
      isGraded,
      marks
    });
    
    // UPSERT behavior so if they re-answer it overwrites the old answer
    return this.videoQuizAnswerModel.findOneAndUpdate(
      { organizationId, studentId, quizId },
      { $set: answerDoc.toObject() },
      { new: true, upsert: true }
    );
  }

  async getVideoQuizAnswers(organizationId: string, courseId: string, lessonId: string) {
    return this.videoQuizAnswerModel
      .find({ organizationId, courseId, lessonId })
      .populate('studentId', 'fullName email')
      .populate('quizId', 'questionText type maxMarks options correctAnswer timestampSeconds')
      .sort({ createdAt: -1 });
  }

  async getMyVideoQuizAnswers(organizationId: string, studentId: string, courseId: string, lessonId: string) {
    return this.videoQuizAnswerModel
      .find({ organizationId, studentId, courseId, lessonId })
      .populate('quizId', 'questionText type maxMarks options correctAnswer timestampSeconds')
      .sort({ createdAt: 1 });
  }

  async gradeVideoQuizAnswer(organizationId: string, graderId: string, answerId: string, marks: number) {
    const ans = await this.videoQuizAnswerModel.findOneAndUpdate(
      { _id: answerId, organizationId },
      { $set: { isGraded: true, marks, gradedBy: graderId, gradedAt: new Date() } },
      { new: true }
    );
    if (!ans) throw new NotFoundException('Answer not found');
    return ans;
  }
}
