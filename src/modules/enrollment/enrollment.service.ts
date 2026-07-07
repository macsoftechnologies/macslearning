import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentDocument } from '../payment/schemas/payment.schema';
import { Enrollment, EnrollmentDocument } from './schemas/enrollment.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EnrollmentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async enrollStudent(studentId: string, organizationId: string, courseId: string, regionId?: string) {
    const course = await this.courseModel.findOne({ _id: courseId, organizationId });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existingEnrollment = await this.enrollmentModel.findOne({ organizationId, studentId, courseId, status: 'ACTIVE' });
    if (existingEnrollment) {
      throw new BadRequestException('You are already enrolled in this course');
    }

    const isPaid = course.pricing?.isPaid || false;
    let amount = course.pricing?.amount || 0;

    if (isPaid && regionId && course.regionalPrices && course.regionalPrices.length > 0) {
      const rp = course.regionalPrices.find(
        (p) => p.regionId?.toString() === regionId.toString()
      );
      if (rp) {
        amount = rp.price;
      }
    }

    let paymentRecord = null;

    if (isPaid) {
      const dummyPaymentId = `DUMMY-${uuidv4()}`;
      
      paymentRecord = await this.paymentModel.create({
        organizationId,
        studentId,
        courseId,
        amount,
        dummyPaymentId,
        status: 'COMPLETED',
        isPaid: true,
        paidAt: new Date(),
        createdBy: studentId,
      });
    }

    let expiresAt: Date | undefined = undefined;
    if (course.validityDays && course.validityDays > 0) {
      expiresAt = new Date(Date.now() + course.validityDays * 24 * 60 * 60 * 1000);
    }

    const enrollment = await this.enrollmentModel.create({
      organizationId,
      studentId,
      courseId,
      paymentStatus: isPaid ? 'PAID' : 'NOT_APPLICABLE',
      source: 'SELF_ENROLL',
      paymentId: paymentRecord ? paymentRecord._id : undefined,
      expiresAt
    });

    await this.courseModel.updateOne(
      { _id: courseId, organizationId },
      { $inc: { enrolledCount: 1 } }
    );

    // Notify student of successful enrollment
    try {
      await this.notificationsService.createNotification(
        organizationId,
        studentId,
        'Enrolled in course',
        `You have been enrolled in course ${course.title || courseId}`,
        'ENROLLMENT',
        `/courses/${courseId}`
      );
    } catch (e) {
      // ignore notification errors
    }

    return {
      success: true,
      dummyPaymentId: paymentRecord ? paymentRecord.dummyPaymentId : null,
      enrollment
    };
  }

  async adminEnrollStudent(adminId: string, organizationId: string, enrollmentData: any) {
    const course = await this.courseModel.findOne({ _id: enrollmentData.courseId, organizationId });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existingEnrollment = await this.enrollmentModel.findOne({
      organizationId,
      studentId: enrollmentData.studentId,
      courseId: enrollmentData.courseId,
      status: 'ACTIVE',
    });
    if (existingEnrollment) {
      throw new BadRequestException('Student is already actively enrolled in this course');
    }

    let expiresAt: Date | undefined = undefined;
    if (course.validityDays && course.validityDays > 0) {
      expiresAt = new Date(Date.now() + course.validityDays * 24 * 60 * 60 * 1000);
    }

    const paymentStatus = enrollmentData.paymentStatus || 'NOT_APPLICABLE';
    const enrollment = new this.enrollmentModel({
      ...enrollmentData,
      organizationId,
      source: 'ADMIN_ENROLL',
      paymentStatus,
      createdBy: adminId,
      expiresAt
    });
    const saved = await enrollment.save();

    await this.courseModel.updateOne(
      { _id: enrollmentData.courseId, organizationId },
      { $inc: { enrolledCount: 1 } }
    );

    try {
      await this.notificationsService.createNotification(
        organizationId,
        saved.studentId.toString(),
        'Enrolled by admin',
        `You have been enrolled in course ${saved.courseId} by admin`,
        'ENROLLMENT',
        `/courses/${saved.courseId}`
      );
    } catch (e) {}

    return saved;
  }

  async getEnrollments(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = { organizationId };
    if (search) {
      query.$or = [
        { paymentStatus: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, totalItems] = await Promise.all([
      this.enrollmentModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.enrollmentModel.countDocuments(query),
    ]);

    if (data.length === 0) {
      return createPaginatedResponse(data, totalItems, page, limit);
    }

    const courseIds = [...new Set(data.map((e: any) => e.courseId?.toString()))];
    const studentIds = [...new Set(data.map((e: any) => e.studentId?.toString()))];

    const lessons = await this.courseModel.db.collection('lessons').find({
      courseId: { $in: courseIds },
      organizationId: organizationId,
      isDeleted: false
    }).toArray();

    const totalLessonsMap: Record<string, number> = {};
    for (const l of lessons) {
      totalLessonsMap[l.courseId] = (totalLessonsMap[l.courseId] || 0) + 1;
    }

    const progresses = await this.courseModel.db.collection('lessonprogresses').find({
      studentId: { $in: studentIds },
      courseId: { $in: courseIds },
      organizationId: organizationId,
      isCompleted: true
    }).toArray();

    const completedMap: Record<string, number> = {};
    for (const p of progresses) {
      const key = `${p.courseId}_${p.studentId}`;
      completedMap[key] = (completedMap[key] || 0) + 1;
    }

    const enrichedData = data.map((e: any) => {
      const cId = e.courseId?.toString() || '';
      const sId = e.studentId?.toString() || '';
      const total = totalLessonsMap[cId] || 0;
      const completed = completedMap[`${cId}_${sId}`] || 0;
      return {
        ...e,
        progressPercentage: total === 0 ? 0 : Math.round((completed / total) * 100)
      };
    });

    return createPaginatedResponse(enrichedData, totalItems, page, limit);
  }

  async updateEnrollmentStatus(enrollmentId: string, organizationId: string, status: string) {
    const enrollment = await this.enrollmentModel.findOneAndUpdate(
      { _id: enrollmentId, organizationId },
      { $set: { status } },
      { new: true }
    );
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    try {
      await this.notificationsService.createNotification(
        organizationId,
        enrollment.studentId.toString(),
        'Enrollment status updated',
        `Your enrollment status for course ${enrollment.courseId} is now ${status}`,
        'ENROLLMENT',
        `/courses/${enrollment.courseId}`
      );
    } catch (e) {}
    return enrollment;
  }

  async getCourseStudents(courseId: string, organizationId: string) {
    const enrollments = await this.enrollmentModel
      .find({ courseId, organizationId })
      .populate('studentId', 'fullName email userType status')
      .sort({ createdAt: -1 })
      .lean();

    const totalLessons = await this.courseModel.db.collection('lessons').countDocuments({ 
      courseId: courseId, 
      organizationId: organizationId,
      isDeleted: false 
    });

    if (totalLessons === 0) return enrollments;

    const progresses = await this.courseModel.db.collection('lessonprogresses').find({
      courseId: courseId,
      organizationId: organizationId,
      isCompleted: true
    }).toArray();

    const progressMap: Record<string, number> = {};
    for (const p of progresses) {
      const sId = p.studentId.toString();
      progressMap[sId] = (progressMap[sId] || 0) + 1;
    }

    return enrollments.map(e => {
      const studentId = e.studentId?._id?.toString() || e.studentId?.toString() || '';
      const completed = progressMap[studentId] || 0;
      return {
        ...e,
        progressPercentage: Math.round((completed / totalLessons) * 100)
      };
    });
  }

  async getStudentEnrollments(studentId: string, organizationId: string) {
    const enrollments = await this.enrollmentModel
      .find({ studentId, organizationId })
      .populate('courseId', 'title description status pricing')
      .sort({ createdAt: -1 })
      .lean();

    if (enrollments.length === 0) return enrollments;

    const courseIds = enrollments.map(e => e.courseId?._id?.toString() || e.courseId?.toString());
    
    const lessons = await this.courseModel.db.collection('lessons').find({
      courseId: { $in: courseIds },
      organizationId: organizationId,
      isDeleted: false
    }).toArray();

    const totalLessonsMap: Record<string, number> = {};
    for (const l of lessons) {
      totalLessonsMap[l.courseId] = (totalLessonsMap[l.courseId] || 0) + 1;
    }

    const progresses = await this.courseModel.db.collection('lessonprogresses').find({
      studentId: studentId,
      courseId: { $in: courseIds },
      organizationId: organizationId,
      isCompleted: true
    }).toArray();

    const completedMap: Record<string, number> = {};
    for (const p of progresses) {
      completedMap[p.courseId] = (completedMap[p.courseId] || 0) + 1;
    }

    return enrollments.map(e => {
      const cId = e.courseId?._id?.toString() || e.courseId?.toString() || '';
      const total = totalLessonsMap[cId] || 0;
      const completed = completedMap[cId] || 0;
      return {
        ...e,
        progressPercentage: total === 0 ? 0 : Math.round((completed / total) * 100)
      };
    });
  }

  async verifyActiveEnrollment(organizationId: string, studentId: string, courseId: string) {
    const enrollment = await this.enrollmentModel.findOne({
      organizationId,
      studentId,
      courseId,
      status: 'ACTIVE',
    });
    if (!enrollment) {
      throw new BadRequestException('Active enrollment is required to access this course');
    }
    
    if (enrollment.expiresAt && new Date() > enrollment.expiresAt) {
      await this.enrollmentModel.updateOne({ _id: enrollment._id }, { $set: { status: 'EXPIRED' } });
      throw new BadRequestException('Your access to this course has expired');
    }
    
    return enrollment;
  }
}

