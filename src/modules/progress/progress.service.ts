import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LessonProgress, LessonProgressDocument } from './schemas/lessonProgress.schema';
import { Lesson, LessonDocument } from '../content/schemas/lesson.schema';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(LessonProgress.name) private progressModel: Model<LessonProgressDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
  ) {}

  async markLessonComplete(organizationId: string, studentId: string, courseId: string, moduleId: string, lessonId: string) {
    const lesson = await this.lessonModel.findOne({ _id: lessonId, courseId, moduleId, organizationId, isDeleted: false });
    if (!lesson) {
      throw new NotFoundException('Lesson not found for provided course/module');
    }
    if (lesson.courseId.toString() !== courseId || lesson.moduleId?.toString() !== moduleId) {
      throw new NotFoundException('Lesson does not belong to provided course/module');
    }

    const progress = await this.progressModel.findOneAndUpdate(
      { organizationId, studentId, courseId, lessonId },
      { 
        $set: { 
          isCompleted: true, 
          completedAt: new Date(), 
          moduleId,
          lastAccessedAt: new Date()
        } 
      },
      { new: true, upsert: true }
    );
    return progress;
  }

  async updateWatchTime(organizationId: string, studentId: string, courseId: string, moduleId: string, lessonId: string, watchedSeconds: number) {
    return this.progressModel.findOneAndUpdate(
      { organizationId, studentId, courseId, lessonId },
      { 
        $set: { 
          watchedSeconds, 
          moduleId,
          lastAccessedAt: new Date()
        } 
      },
      { new: true, upsert: true }
    );
  }

  async getCourseProgress(organizationId: string, studentId: string, courseId: string) {
    const progressList = await this.progressModel.find({
      organizationId,
      studentId,
      courseId,
    }).lean();

    const totalLessons = await this.lessonModel.countDocuments({ courseId, organizationId, isDeleted: false });
    const completedCount = progressList.filter(p => p.isCompleted).length;
    
    let progressPercentage = 0;
    if (totalLessons > 0) {
      progressPercentage = Math.round((completedCount / totalLessons) * 100);
    }

    return {
      progressPercentage,
      completedLessonIds: progressList.filter(p => p.isCompleted).map(p => p.lessonId),
      completedLessons: progressList
    };
  }

  async getAllStudentProgressForCourse(organizationId: string, courseId: string) {
    return this.progressModel.find({ organizationId, courseId }).populate('studentId', 'fullName email');
  }

  async getStudentProgressDetail(organizationId: string, courseId: string, studentId: string) {
    return this.progressModel.find({ organizationId, courseId, studentId }).populate('lessonId', 'title type');
  }

  async hasPassedCheckpoint(organizationId: string, studentId: string, lessonId: string, checkpointId: string) {
    const progress = await this.progressModel.findOne({ organizationId, studentId, lessonId });
    if (!progress) return false;
    return (progress.checkpointPassedIds || []).some(id => id.toString() === checkpointId.toString());
  }
}
