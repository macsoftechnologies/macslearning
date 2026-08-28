import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, DataSource } from 'typeorm';
import { Course } from './entities/course.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { CoursePlan } from '../organizations/entities/course-plan.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { ProgramCourseMapping } from '../programs/entities/program-course-mapping.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(CoursePlan)
    private coursePlanRepository: Repository<CoursePlan>,
    @InjectRepository(ProgramCourseMapping)
    private programCourseMappingRepository: Repository<ProgramCourseMapping>,
    private dataSource: DataSource,
  ) {}

  async createCourse(
    organizationId: string,
    creatorId: string,
    courseData: any,
  ) {
    const slug = this.generateCourseSlug(courseData?.title);
    const { programIds, ...restCourseData } = courseData;

    let validityDays = restCourseData.validityDays || 0;
    if (restCourseData.coursePlanId) {
      const plan = await this.coursePlanRepository.findOne({
        where: { id: restCourseData.coursePlanId },
      });
      if (!plan) throw new NotFoundException('Course plan not found');
      validityDays = plan.validityDays || 0;
    }

    const course = this.courseRepository.create({
      ...restCourseData,
      slug,
      validityDays,
      organizationId,
      instructorIds:
        restCourseData.instructorIds && restCourseData.instructorIds.length > 0
          ? restCourseData.instructorIds
          : [creatorId],
      createdBy: creatorId,
    });
    const savedCourse = await this.courseRepository.save(course as any) as unknown as Course;

    if (programIds && Array.isArray(programIds)) {
      for (const programId of programIds) {
        const mapping = this.programCourseMappingRepository.create({
          organizationId,
          courseId: savedCourse.id,
          programId,
          // semesterId is optional now, so we leave it null/undefined
        });
        await this.programCourseMappingRepository.save(mapping);
      }
    }

    return savedCourse;
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
    programId?: string,
    semesterId?: string,
  ) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.courseRepository
      .createQueryBuilder('course')
      .where('course.organizationId = :organizationId', { organizationId })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false });

    if (programId) {
      queryBuilder.innerJoin(
        'program_course_mappings',
        'pcm',
        'pcm.courseId = course.id AND pcm.programId = :programId',
        { programId }
      );
      if (semesterId) {
        queryBuilder.andWhere('pcm.semesterId = :semesterId', { semesterId });
      }
    } else if (semesterId) {
      queryBuilder.innerJoin(
        'program_course_mappings',
        'pcm',
        'pcm.courseId = course.id AND pcm.semesterId = :semesterId',
        { semesterId }
      );
    }

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
      if (status === 'IN_REVIEW') {
        queryBuilder.andWhere(`
          (course.status = 'IN_REVIEW' OR 
           EXISTS (SELECT 1 FROM coursemodules cm WHERE cm.courseId = course.id AND cm.contentStatus = 'IN_REVIEW') OR
           EXISTS (SELECT 1 FROM lessons l WHERE l.courseId = course.id AND l.contentStatus = 'IN_REVIEW') OR
           EXISTS (SELECT 1 FROM exams e WHERE e.courseId = course.id AND e.status = 'IN_REVIEW'))
        `);
      } else {
        queryBuilder.andWhere('course.status = :status', { status });
      }
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

    if (data.length > 0) {
      try {
        const courseIds = data.map((c) => c.id);
        const lessonCounts = await this.dataSource
          .getRepository(Lesson)
          .createQueryBuilder('l')
          .select('l.courseId', 'courseId')
          .addSelect('COUNT(*)', 'count')
          .where('l.courseId IN (:...courseIds)', { courseIds })
          .andWhere('l.isDeleted = :isDeleted', { isDeleted: false })
          .andWhere('(l.videoUrl IS NOT NULL AND l.videoUrl != "" OR l.type = "VIDEO")')
          .groupBy('l.courseId')
          .getRawMany();

        const videoCountMap: Record<string, number> = {};
        lessonCounts.forEach((lc: any) => {
          videoCountMap[lc.courseId] = parseInt(lc.count) || 0;
        });

        data.forEach((c) => {
          (c as any).videosCount = videoCountMap[c.id] || 0;
          (c as any).totalVideos = videoCountMap[c.id] || 0;
        });
      } catch (err: any) {
        console.warn('Could not populate video counts for courses', err);
      }
    }

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

    const mappings = await this.programCourseMappingRepository.find({
      where: { courseId: course.id }
    });
    
    return { ...course, programIds: mappings.map(m => m.programId) };
  }

  async updateCourse(
    courseId: string,
    organizationId: string,
    updateData: any,
  ) {
    const { programIds, ...restUpdateData } = updateData;
    const updateFields: any = {};
    for (const [key, value] of Object.entries(restUpdateData || {})) {
      if (value !== undefined) {
        updateFields[key] = value;
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await this.courseRepository.update(
        { id: courseId, organizationId, isDeleted: false },
        updateFields,
      );
    }
    
    if (programIds !== undefined && Array.isArray(programIds)) {
      await this.programCourseMappingRepository.delete({ courseId });
      for (const programId of programIds) {
        await this.programCourseMappingRepository.save(
          this.programCourseMappingRepository.create({
            organizationId,
            courseId,
            programId
          })
        );
      }
    }
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
