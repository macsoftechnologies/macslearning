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

  async enrollStudent(studentId: string, organizationId: string, courseId: string) {
    const course = await this.courseModel.findOne({ _id: courseId, organizationId });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existingEnrollment = await this.enrollmentModel.findOne({ organizationId, studentId, courseId, status: 'ACTIVE' });
    if (existingEnrollment) {
      throw new BadRequestException('You are already enrolled in this course');
    }

    const isPaid = course.pricing?.isPaid || false;
    const amount = course.pricing?.amount || 0;

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

    const enrollment = await this.enrollmentModel.create({
      organizationId,
      studentId,
      courseId,
      paymentStatus: isPaid ? 'PAID' : 'NOT_APPLICABLE',
      source: 'SELF_ENROLL',
      paymentId: paymentRecord ? paymentRecord._id : undefined
    });

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

    const paymentStatus = enrollmentData.paymentStatus || 'NOT_APPLICABLE';
    const enrollment = new this.enrollmentModel({
      ...enrollmentData,
      organizationId,
      source: 'ADMIN_ENROLL',
      paymentStatus,
      createdBy: adminId,
    });
    const saved = await enrollment.save();

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
      this.enrollmentModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.enrollmentModel.countDocuments(query),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
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
    return this.enrollmentModel
      .find({ courseId, organizationId })
      .populate('studentId', 'fullName email userType status')
      .sort({ createdAt: -1 });
  }

  async getStudentEnrollments(studentId: string, organizationId: string) {
    return this.enrollmentModel
      .find({ studentId, organizationId })
      .populate('courseId', 'title description status pricing')
      .sort({ createdAt: -1 });
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
    return enrollment;
  }
}

