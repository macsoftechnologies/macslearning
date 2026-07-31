import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../payment/entities/payment.entity';
import { Enrollment } from './entities/enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { LessonProgress } from '../progress/entities/lessonProgress.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class EnrollmentService {
  constructor(
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(Lesson) private lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonProgress)
    private lessonProgressRepository: Repository<LessonProgress>,
    private notificationsService: NotificationsService,
  ) {}

  async enrollStudent(
    studentId: string,
    organizationId: string,
    courseId: string,
    regionId?: string,
  ) {
    const course = await this.courseRepository.findOne({
      where: { id: courseId, organizationId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: { organizationId, studentId, courseId, status: 'ACTIVE' },
    });
    if (existingEnrollment) {
      throw new BadRequestException('You are already enrolled in this course');
    }

    let isPaid = false;
    let amount = 0;

    // In MySQL, course.pricing might be a JSON object
    const pricing = course.pricing;
    if (pricing) {
      isPaid = pricing.isPaid || false;
      amount = parseFloat(pricing.amount) || 0;
    }

    if (
      isPaid &&
      regionId &&
      course.regionalPrices
    ) {
      let parsedPrices = course.regionalPrices;
      if (typeof parsedPrices === 'string') {
        try {
          parsedPrices = JSON.parse(parsedPrices);
        } catch (e) {}
      }
      
      if (Array.isArray(parsedPrices) && parsedPrices.length > 0) {
        const rp = parsedPrices.find(
          (p: any) =>
            p.regionId === regionId ||
            (p.regionId && p.regionId._id === regionId) ||
            (p.regionId && p.regionId.id === regionId),
        );
        if (rp) {
          amount = parseFloat(rp.price) || 0;
        }
      }
    }

    let paymentRecord = null;

    if (isPaid) {
      const dummyPaymentId = `DUMMY-${uuidv4()}`;

      const payment = this.paymentRepository.create({
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
      paymentRecord = await this.paymentRepository.save(payment);
    }

    let expiresAt: Date | undefined = undefined;
    if (course.validityDays && course.validityDays > 0) {
      expiresAt = new Date(
        Date.now() + course.validityDays * 24 * 60 * 60 * 1000,
      );
    }

    const enrollment = this.enrollmentRepository.create({
      organizationId,
      studentId,
      courseId,
      paymentStatus: isPaid ? 'PAID' : 'NOT_APPLICABLE',
      source: 'SELF_ENROLL',
      paymentId: paymentRecord ? paymentRecord.id : undefined,
      expiresAt,
    });

    await this.enrollmentRepository.save(enrollment);

    await this.courseRepository.update(
      { id: courseId, organizationId },
      { enrolledCount: (course.enrolledCount || 0) + 1 },
    );

    // Notify student of successful enrollment
    try {
      await this.notificationsService.createNotification(
        organizationId,
        studentId,
        'Enrolled in course',
        `You have been enrolled in course ${course.title || courseId}`,
        'ENROLLMENT',
        `/courses/${courseId}`,
      );
    } catch (e) {
      // ignore notification errors
    }

    // Notify faculty
    if (course.instructorIds && course.instructorIds.length > 0) {
      try {
        await this.notificationsService.createNotificationsBulk(
          organizationId,
          course.instructorIds,
          'New Student Enrolled',
          `A new student has enrolled in your course "${course.title || courseId}".`,
          'ENROLLMENT',
          `/faculty/courses/${courseId}/students`,
        );
      } catch (e) {}
    }

    return {
      success: true,
      dummyPaymentId: paymentRecord ? paymentRecord.dummyPaymentId : null,
      amount: paymentRecord ? paymentRecord.amount : null,
      debug: {
        regionId,
        parsedPrices: course.regionalPrices,
      },
      enrollment,
    };
  }

  async adminEnrollStudent(
    adminId: string,
    organizationId: string,
    enrollmentData: any,
  ) {
    const course = await this.courseRepository.findOne({
      where: { id: enrollmentData.courseId, organizationId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        organizationId,
        studentId: enrollmentData.studentId,
        courseId: enrollmentData.courseId,
        status: 'ACTIVE',
      },
    });
    if (existingEnrollment) {
      throw new BadRequestException(
        'Student is already actively enrolled in this course',
      );
    }

    let expiresAt: Date | undefined = undefined;
    if (course.validityDays && course.validityDays > 0) {
      expiresAt = new Date(
        Date.now() + course.validityDays * 24 * 60 * 60 * 1000,
      );
    }

    const paymentStatus = enrollmentData.paymentStatus || 'NOT_APPLICABLE';
    const enrollment = this.enrollmentRepository.create({
      ...enrollmentData,
      organizationId,
      source: 'ADMIN_ENROLL',
      paymentStatus,
      createdBy: adminId,
      expiresAt,
    });
    const saved = await this.enrollmentRepository.save(enrollment as any);

    await this.courseRepository.update(
      { id: enrollmentData.courseId, organizationId },
      { enrolledCount: (course.enrolledCount || 0) + 1 },
    );

    try {
      await this.notificationsService.createNotification(
        organizationId,
        saved.studentId,
        'Enrolled by admin',
        `You have been enrolled in course ${saved.courseId} by admin`,
        'ENROLLMENT',
        `/courses/${saved.courseId}`,
      );
    } catch (e) {}

    return saved;
  }

  async getEnrollments(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .where('enrollment.organizationId = :organizationId', { organizationId });

    if (search) {
      queryBuilder.andWhere(
        '(enrollment.paymentStatus LIKE :search OR enrollment.source LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, totalItems] = await queryBuilder
      .orderBy('enrollment.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    if (data.length === 0) {
      return createPaginatedResponse(data, totalItems, page, limit);
    }

    const courseIds = [...new Set(data.map((e: any) => e.courseId))];
    const studentIds = [...new Set(data.map((e: any) => e.studentId))];

    const lessonsQuery = this.lessonRepository
      .createQueryBuilder('lesson')
      .where('lesson.organizationId = :organizationId', { organizationId })
      .andWhere('lesson.isDeleted = :isDeleted', { isDeleted: false });

    if (courseIds.length > 0) {
      lessonsQuery.andWhere('lesson.courseId IN (:...courseIds)', {
        courseIds,
      });
    }
    const lessons = await lessonsQuery.getMany();

    const totalLessonsMap: Record<string, number> = {};
    for (const l of lessons) {
      totalLessonsMap[l.courseId] = (totalLessonsMap[l.courseId] || 0) + 1;
    }

    const progressesQuery = this.lessonProgressRepository
      .createQueryBuilder('progress')
      .where('progress.organizationId = :organizationId', { organizationId })
      .andWhere('progress.isCompleted = :isCompleted', { isCompleted: true });

    if (studentIds.length > 0) {
      progressesQuery.andWhere('progress.studentId IN (:...studentIds)', {
        studentIds,
      });
    }
    if (courseIds.length > 0) {
      progressesQuery.andWhere('progress.courseId IN (:...courseIds)', {
        courseIds,
      });
    }
    const progresses = await progressesQuery.getMany();

    const completedMap: Record<string, number> = {};
    for (const p of progresses) {
      const key = `${p.courseId}_${p.studentId}`;
      completedMap[key] = (completedMap[key] || 0) + 1;
    }

    const enrichedData = data.map((e: any) => {
      const cId = e.courseId || '';
      const sId = e.studentId || '';
      const total = totalLessonsMap[cId] || 0;
      const completed = completedMap[`${cId}_${sId}`] || 0;
      return {
        ...e,
        progressPercentage:
          total === 0 ? 0 : Math.round((completed / total) * 100),
      };
    });

    return createPaginatedResponse(enrichedData, totalItems, page, limit);
  }

  async updateEnrollmentStatus(
    enrollmentId: string,
    organizationId: string,
    status: string,
  ) {
    await this.enrollmentRepository.update(
      { id: enrollmentId, organizationId },
      { status },
    );
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id: enrollmentId, organizationId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    try {
      await this.notificationsService.createNotification(
        organizationId,
        enrollment.studentId,
        'Enrollment status updated',
        `Your enrollment status for course ${enrollment.courseId} is now ${status}`,
        'ENROLLMENT',
        `/courses/${enrollment.courseId}`,
      );
    } catch (e) {}
    return enrollment;
  }

  async getCourseStudents(courseId: string, organizationId: string) {
    const enrollments = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoin(User, 'student', 'student.id = enrollment.studentId')
      .where('enrollment.courseId = :courseId', { courseId })
      .andWhere('enrollment.organizationId = :organizationId', {
        organizationId,
      })
      .select([
        'enrollment.*',
        'student.id as student_id',
        'student.fullName as student_fullName',
        'student.email as student_email',
        'student.userType as student_userType',
        'student.status as student_status',
      ])
      .orderBy('enrollment.createdAt', 'DESC')
      .getRawMany();

    const mappedEnrollments = enrollments.map((e) => ({
      ...e,
      studentId: {
        _id: e.student_id,
        id: e.student_id,
        fullName: e.student_fullName,
        email: e.student_email,
        userType: e.student_userType,
        status: e.student_status,
      },
    }));

    const totalLessons = await this.lessonRepository.count({
      where: { courseId, organizationId, isDeleted: false },
    });

    if (totalLessons === 0) return mappedEnrollments;

    const progresses = await this.lessonProgressRepository.find({
      where: { courseId, organizationId, isCompleted: true },
    });

    const progressMap: Record<string, number> = {};
    for (const p of progresses) {
      const sId = p.studentId;
      progressMap[sId] = (progressMap[sId] || 0) + 1;
    }

    return mappedEnrollments.map((e) => {
      const studentId = e.studentId.id || '';
      const completed = progressMap[studentId] || 0;
      return {
        ...e,
        progressPercentage: Math.round((completed / totalLessons) * 100),
      };
    });
  }

  async getStudentEnrollments(studentId: string, organizationId: string) {
    const enrollments = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoin(Course, 'course', 'course.id = enrollment.courseId')
      .where('enrollment.studentId = :studentId', { studentId })
      .andWhere('enrollment.organizationId = :organizationId', {
        organizationId,
      })
      .select([
        'enrollment.*',
        'course.id as course_id',
        'course.title as course_title',
        'course.description as course_description',
        'course.status as course_status',
        'course.pricing as course_pricing',
      ])
      .orderBy('enrollment.createdAt', 'DESC')
      .getRawMany();

    const mappedEnrollments = enrollments.map((e) => ({
      ...e,
      courseId: {
        _id: e.course_id,
        id: e.course_id,
        title: e.course_title,
        description: e.course_description,
        status: e.course_status,
        pricing: e.course_pricing,
      },
    }));

    if (mappedEnrollments.length === 0) return mappedEnrollments;

    const courseIds = mappedEnrollments.map((e) => e.courseId.id);

    const lessonsQuery = this.lessonRepository
      .createQueryBuilder('lesson')
      .where('lesson.organizationId = :organizationId', { organizationId })
      .andWhere('lesson.isDeleted = :isDeleted', { isDeleted: false });

    if (courseIds.length > 0) {
      lessonsQuery.andWhere('lesson.courseId IN (:...courseIds)', {
        courseIds,
      });
    }
    const lessons = await lessonsQuery.getMany();

    const totalLessonsMap: Record<string, number> = {};
    for (const l of lessons) {
      totalLessonsMap[l.courseId] = (totalLessonsMap[l.courseId] || 0) + 1;
    }

    const progressesQuery = this.lessonProgressRepository
      .createQueryBuilder('progress')
      .where('progress.organizationId = :organizationId', { organizationId })
      .andWhere('progress.studentId = :studentId', { studentId })
      .andWhere('progress.isCompleted = :isCompleted', { isCompleted: true });

    if (courseIds.length > 0) {
      progressesQuery.andWhere('progress.courseId IN (:...courseIds)', {
        courseIds,
      });
    }
    const progresses = await progressesQuery.getMany();

    const completedMap: Record<string, number> = {};
    for (const p of progresses) {
      completedMap[p.courseId] = (completedMap[p.courseId] || 0) + 1;
    }

    return mappedEnrollments.map((e) => {
      const cId = e.courseId.id || '';
      const total = totalLessonsMap[cId] || 0;
      const completed = completedMap[cId] || 0;
      return {
        ...e,
        progressPercentage:
          total === 0 ? 0 : Math.round((completed / total) * 100),
      };
    });
  }

  async verifyActiveEnrollment(
    organizationId: string,
    studentId: string,
    courseId: string,
  ) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        organizationId,
        studentId,
        courseId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) {
      throw new BadRequestException(
        'Active enrollment is required to access this course',
      );
    }

    if (enrollment.expiresAt && new Date() > enrollment.expiresAt) {
      await this.enrollmentRepository.update(
        { id: enrollment.id },
        { status: 'EXPIRED' },
      );
      throw new BadRequestException('Your access to this course has expired');
    }

    return enrollment;
  }
}
