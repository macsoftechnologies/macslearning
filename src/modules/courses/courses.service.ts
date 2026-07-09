import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Course } from './entities/course.entity';
import { CoursePlan } from '../organizations/entities/course-plan.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { User } from '../users/entities/user.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(CoursePlan)
    private coursePlanRepository: Repository<CoursePlan>,
  ) {}

  async createCourse(
    organizationId: string,
    creatorId: string,
    courseData: any,
  ) {
    const slug = this.generateCourseSlug(courseData?.title);

    let validityDays = courseData.validityDays || 0;
    if (courseData.coursePlanId) {
      const plan = await this.coursePlanRepository.findOne({
        where: { id: courseData.coursePlanId },
      });
      if (!plan) throw new NotFoundException('Course plan not found');
      validityDays = plan.validityDays || 0;
    }

    const course = this.courseRepository.create({
      ...courseData,
      slug,
      validityDays,
      organizationId,
      instructorIds:
        courseData.instructorIds && courseData.instructorIds.length > 0
          ? courseData.instructorIds
          : [creatorId],
      createdBy: creatorId,
    });
    return this.courseRepository.save(course as any) as unknown as Course;
  }

  private generateCourseSlug(title?: string): string {
    return (title || 'course')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async getCourses(
    organizationId: string,
    queryDto: PaginationQueryDto,
    status?: string,
    userType?: string,
    userId?: string,
  ) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.courseRepository
      .createQueryBuilder('course')
      .where('course.organizationId = :organizationId', { organizationId })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false });

    if (userType === 'STUDENT') {
      queryBuilder.andWhere('course.status = :status', { status: 'PUBLISHED' });
    } else if (userType === 'FACULTY' && userId) {
      // In MySQL, checking if a json array contains a value. If instructorIds is stored as simple text, LIKE works.
      queryBuilder.andWhere('course.instructorIds LIKE :userId', {
        userId: `%${userId}%`,
      });
      if (status) {
        queryBuilder.andWhere('course.status = :status', { status });
      }
    } else if (status) {
      queryBuilder.andWhere('course.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('course.title LIKE :search', {
        search: `%${search}%`,
      });
    }

    // Attempting raw join for instructors manually if needed,
    // but the frontend may not strictly require populated objects if it only shows count or we just map it.
    // For exact match parity, we could join User for each instructor, but since instructorIds is a JSON array of strings,
    // we'll just fetch courses and do an in-memory resolution for simplicity in this migration step.

    queryBuilder.orderBy('course.createdAt', 'DESC').skip(skip).take(limit);

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    // Optionally populate instructors in memory
    // this avoids complex json_table joins in mysql 5.7+

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getCourseById(
    courseId: string,
    organizationId: string,
    userType?: string,
  ) {
    const queryBuilder = this.courseRepository
      .createQueryBuilder('course')
      .where('course.id = :courseId', { courseId })
      .andWhere('course.organizationId = :organizationId', { organizationId })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false });

    if (userType === 'STUDENT') {
      queryBuilder.andWhere('course.status = :status', { status: 'PUBLISHED' });
    }

    const course = await queryBuilder.getOne();
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async updateCourse(
    courseId: string,
    organizationId: string,
    updateData: any,
  ) {
    const updateFields: any = {};
    for (const [key, value] of Object.entries(updateData || {})) {
      if (value !== undefined) {
        updateFields[key] = value;
      }
    }

    await this.courseRepository.update(
      { id: courseId, organizationId, isDeleted: false },
      updateFields,
    );
    const course = await this.courseRepository.findOne({
      where: { id: courseId, organizationId, isDeleted: false },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async deleteCourse(courseId: string, organizationId: string) {
    await this.courseRepository.update(
      { id: courseId, organizationId, isDeleted: false },
      { isDeleted: true },
    );
    const course = await this.courseRepository.findOne({
      where: { id: courseId, organizationId, isDeleted: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }
}
