import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonProgress } from './entities/lessonProgress.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(LessonProgress)
    private progressRepository: Repository<LessonProgress>,
    @InjectRepository(Lesson) private lessonRepository: Repository<Lesson>,
  ) {}

  async markLessonComplete(
    organizationId: string,
    studentId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
  ) {
    const lesson = await this.lessonRepository.findOne({
      where: {
        id: lessonId,
        courseId,
        moduleId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!lesson) {
      throw new NotFoundException(
        'Lesson not found for provided course/module',
      );
    }
    if (lesson.courseId !== courseId || lesson.moduleId !== moduleId) {
      throw new NotFoundException(
        'Lesson does not belong to provided course/module',
      );
    }

    let progress = await this.progressRepository.findOne({
      where: { organizationId, studentId, courseId, lessonId },
    });

    if (progress) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
      progress.moduleId = moduleId;
      progress.lastAccessedAt = new Date();
    } else {
      progress = this.progressRepository.create({
        organizationId,
        studentId,
        courseId,
        moduleId,
        lessonId,
        isCompleted: true,
        completedAt: new Date(),
        lastAccessedAt: new Date(),
      });
    }

    return this.progressRepository.save(progress);
  }

  async updateWatchTime(
    organizationId: string,
    studentId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    watchedSeconds: number,
  ) {
    let progress = await this.progressRepository.findOne({
      where: { organizationId, studentId, courseId, lessonId },
    });

    if (progress) {
      progress.watchedSeconds = watchedSeconds;
      progress.moduleId = moduleId;
      progress.lastAccessedAt = new Date();
    } else {
      progress = this.progressRepository.create({
        organizationId,
        studentId,
        courseId,
        moduleId,
        lessonId,
        watchedSeconds,
        lastAccessedAt: new Date(),
      });
    }

    return this.progressRepository.save(progress);
  }

  async getCourseProgress(
    organizationId: string,
    studentId: string,
    courseId: string,
  ) {
    const progressList = await this.progressRepository.find({
      where: {
        organizationId,
        studentId,
        courseId,
      },
    });

    const totalLessons = await this.lessonRepository.count({
      where: { courseId, organizationId, isDeleted: false },
    });
    const completedCount = progressList.filter((p) => p.isCompleted).length;

    let progressPercentage = 0;
    if (totalLessons > 0) {
      progressPercentage = Math.round((completedCount / totalLessons) * 100);
    }

    return {
      progressPercentage,
      completedLessonIds: progressList
        .filter((p) => p.isCompleted)
        .map((p) => p.lessonId),
      completedLessons: progressList,
    };
  }

  async getAllStudentProgressForCourse(
    organizationId: string,
    courseId: string,
  ) {
    const progresses = await this.progressRepository
      .createQueryBuilder('progress')
      .leftJoin(User, 'student', 'student.id = progress.studentId')
      .where('progress.organizationId = :organizationId', { organizationId })
      .andWhere('progress.courseId = :courseId', { courseId })
      .select([
        'progress.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
      ])
      .getRawMany();

    return progresses.map((p) => ({
      ...p,
      studentId: {
        _id: p.student_id,
        id: p.student_id,
        fullName: p.student_fullName,
        email: p.student_email,
      },
    }));
  }

  async getStudentProgressDetail(
    organizationId: string,
    courseId: string,
    studentId: string,
  ) {
    const progresses = await this.progressRepository
      .createQueryBuilder('progress')
      .leftJoin(Lesson, 'lesson', 'lesson.id = progress.lessonId')
      .where('progress.organizationId = :organizationId', { organizationId })
      .andWhere('progress.courseId = :courseId', { courseId })
      .andWhere('progress.studentId = :studentId', { studentId })
      .select([
        'progress.*',
        'lesson.id as lesson_id',
        'lesson.title as lesson_title',
        'lesson.type as lesson_type',
      ])
      .getRawMany();

    return progresses.map((p) => ({
      ...p,
      lessonId: {
        _id: p.lesson_id,
        id: p.lesson_id,
        title: p.lesson_title,
        type: p.lesson_type,
      },
    }));
  }

  async hasPassedCheckpoint(
    organizationId: string,
    studentId: string,
    lessonId: string,
    checkpointId: string,
  ) {
    const progress = await this.progressRepository.findOne({
      where: { organizationId, studentId, lessonId },
    });
    if (!progress) return false;

    let passedIds: any[] = progress.checkpointPassedIds || [];
    if (typeof passedIds === 'string') {
      try {
        passedIds = JSON.parse(passedIds);
      } catch (e) {
        passedIds = [];
      }
    }

    return passedIds.some((id: any) => String(id) === String(checkpointId));
  }
}
