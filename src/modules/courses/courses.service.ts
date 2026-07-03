import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class CoursesService {
  constructor(@InjectModel(Course.name) private courseModel: Model<CourseDocument>) {}

  async createCourse(organizationId: string, instructorId: string, courseData: any) {
    const slug = this.generateCourseSlug(courseData?.title);

    const course = new this.courseModel({
      ...courseData,
      slug,
      organizationId,
      instructorId,
      createdBy: instructorId,
    });
    return course.save();
  }

  private generateCourseSlug(title?: string): string {
    return (title || 'course')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async getCourses(organizationId: string, queryDto: PaginationQueryDto, status?: string, userType?: string) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = { organizationId, isDeleted: false };
    
    if (userType === 'STUDENT') {
      query.status = 'PUBLISHED';
    } else if (status) {
      query.status = status;
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      this.courseModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.courseModel.countDocuments(query),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getCourseById(courseId: string, organizationId: string, userType?: string) {
    const query: any = { _id: courseId, organizationId, isDeleted: false };
    if (userType === 'STUDENT') {
      query.status = 'PUBLISHED';
    }

    const course = await this.courseModel.findOne(query);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async updateCourse(courseId: string, organizationId: string, updateData: any) {
    const updateFields: any = {};
    for (const [key, value] of Object.entries(updateData || {})) {
      if (value !== undefined) {
        updateFields[key] = value;
      }
    }

    const course = await this.courseModel.findOneAndUpdate(
      { _id: courseId, organizationId, isDeleted: false },
      { $set: updateFields },
      { new: true }
    );
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async deleteCourse(courseId: string, organizationId: string) {
    const course = await this.courseModel.findOneAndUpdate(
      { _id: courseId, organizationId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }
}
