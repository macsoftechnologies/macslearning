import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Course } from '../courses/entities/course.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { LessonProgress } from '../progress/entities/lessonProgress.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';
import { Organization } from '../organizations/entities/org.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(LessonProgress)
    private progressRepository: Repository<LessonProgress>,
    @InjectRepository(AssessmentResult)
    private resultRepository: Repository<AssessmentResult>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
  ) {}

  async getOverviewStats(organizationId: string) {
    const totalStudents = await this.userRepository.count({
      where: { organizationId, userType: 'STUDENT', status: 'ACTIVE' },
    });
    const pendingApprovals = await this.userRepository.count({
      where: { organizationId, userType: 'STUDENT', status: 'PENDING' },
    });
    const totalFaculty = await this.userRepository.count({
      where: { organizationId, userType: 'FACULTY' },
    });
    const activeCourses = await this.courseRepository.count({
      where: { organizationId, status: 'PUBLISHED', isDeleted: false },
    });
    const totalEnrollments = await this.enrollmentRepository.count({
      where: { organizationId },
    });

    const paymentAgg = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.organizationId = :organizationId', { organizationId })
      .andWhere('payment.status = :status', { status: 'COMPLETED' })
      .select('SUM(payment.amount)', 'totalRevenue')
      .getRawOne();

    const revenue = parseFloat(paymentAgg?.totalRevenue || '0');

    return {
      totalStudents,
      pendingApprovals,
      activeCourses,
      totalFaculty,
      totalEnrollments,
      revenue,
    };
  }

  async getSuperAdminStats() {
    const totalOrganizations = await this.orgRepository.count({
      where: { isDeleted: false },
    });
    const totalUsers = await this.userRepository.count();
    const totalStudents = await this.userRepository.count({
      where: { userType: 'STUDENT' },
    });
    const totalFaculty = await this.userRepository.count({
      where: { userType: 'FACULTY' },
    });
    const totalCourses = await this.courseRepository.count({
      where: { isDeleted: false },
    });

    const paymentAgg = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: 'COMPLETED' })
      .select('SUM(payment.amount)', 'totalRevenue')
      .getRawOne();

    const totalRevenue = parseFloat(paymentAgg?.totalRevenue || '0');

    return {
      totalOrganizations,
      totalUsers,
      totalStudents,
      totalFaculty,
      totalCourses,
      totalRevenue,
    };
  }

  async getCoursePerformance(organizationId: string) {
    const courses = await this.courseRepository.find({
      where: { organizationId, isDeleted: false },
      select: {
        id: true,
        title: true,
        status: true,
        categoryId: true,
        createdAt: true,
      },
    });
    const courseIds = courses.map((course) => course.id);

    if (!courseIds.length) {
      return { totalCourses: 0, courses: [] };
    }

    const enrollmentStats = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .where('enrollment.organizationId = :organizationId', { organizationId })
      .andWhere('enrollment.courseId IN (:...courseIds)', { courseIds })
      .select('enrollment.courseId', 'courseId')
      .addSelect('COUNT(*)', 'totalEnrollments')
      .addSelect(
        "SUM(CASE WHEN enrollment.status = 'ACTIVE' THEN 1 ELSE 0 END)",
        'activeEnrollments',
      )
      .addSelect(
        "SUM(CASE WHEN enrollment.status = 'COMPLETED' THEN 1 ELSE 0 END)",
        'completedEnrollments',
      )
      .groupBy('enrollment.courseId')
      .getRawMany();

    const progressStats = await this.progressRepository
      .createQueryBuilder('progress')
      .where('progress.organizationId = :organizationId', { organizationId })
      .andWhere('progress.courseId IN (:...courseIds)', { courseIds })
      .select('progress.courseId', 'courseId')
      .addSelect(
        'AVG(CASE WHEN progress.isCompleted = true THEN 1 ELSE 0 END)',
        'averageCompletion',
      )
      .groupBy('progress.courseId')
      .getRawMany();

    const resultStats = await this.resultRepository
      .createQueryBuilder('result')
      .where('result.organizationId = :organizationId', { organizationId })
      .andWhere('result.courseId IN (:...courseIds)', { courseIds })
      .select('result.courseId', 'courseId')
      .addSelect('COUNT(*)', 'totalResults')
      .addSelect(
        'SUM(CASE WHEN result.isPassed = true THEN 1 ELSE 0 END)',
        'passedCount',
      )
      .addSelect('AVG(result.percentage)', 'averageScore')
      .groupBy('result.courseId')
      .getRawMany();

    const enrollmentByCourse = new Map(
      enrollmentStats.map((stat) => [stat.courseId, stat]),
    );
    const progressByCourse = new Map(
      progressStats.map((stat) => [stat.courseId, stat]),
    );
    const resultByCourse = new Map(
      resultStats.map((stat) => [stat.courseId, stat]),
    );

    const coursePerformance = courses.map((course) => {
      const courseId = course.id;
      const enrollment = enrollmentByCourse.get(courseId) || {
        totalEnrollments: 0,
        activeEnrollments: 0,
        completedEnrollments: 0,
      };
      const progress = progressByCourse.get(courseId) || {
        averageCompletion: 0,
      };
      const result = resultByCourse.get(courseId) || {
        totalResults: 0,
        passedCount: 0,
        averageScore: 0,
      };

      return {
        courseId,
        title: course.title,
        status: course.status,
        categoryId: course.categoryId,
        createdAt: course.createdAt,
        enrolledCount: parseInt(enrollment.totalEnrollments || '0', 10),
        completionRate: Number(
          (parseFloat(progress.averageCompletion || '0') * 100).toFixed(2),
        ),
        avgScore: Number(parseFloat(result.averageScore || '0').toFixed(2)),
        totalEnrollments: parseInt(enrollment.totalEnrollments || '0', 10),
        activeEnrollments: parseInt(enrollment.activeEnrollments || '0', 10),
        completedEnrollments: parseInt(
          enrollment.completedEnrollments || '0',
          10,
        ),
        averageProgress: Number(
          (parseFloat(progress.averageCompletion || '0') * 100).toFixed(2),
        ),
        averageScore: Number(parseFloat(result.averageScore || '0').toFixed(2)),
        passRate:
          parseInt(result.totalResults || '0', 10) > 0
            ? Number(
                (
                  (parseInt(result.passedCount || '0', 10) /
                    parseInt(result.totalResults || '0', 10)) *
                  100
                ).toFixed(2),
              )
            : 0,
      };
    });

    return {
      totalCourses: courses.length,
      courses: coursePerformance,
    };
  }

  async getStudentActivity(organizationId: string) {
    const students = await this.userRepository.find({
      where: { organizationId, userType: 'STUDENT', isDeleted: false },
      select: { id: true, fullName: true, email: true, lastLogin: true },
    });

    if (students.length === 0) return [];
    const studentIds = students.map((s) => s.id);

    const enrollments = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .where('enrollment.organizationId = :organizationId', { organizationId })
      .andWhere('enrollment.studentId IN (:...studentIds)', { studentIds })
      .select('enrollment.studentId', 'studentId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('enrollment.studentId')
      .getRawMany();
    const enrollmentsMap = new Map(
      enrollments.map((e) => [e.studentId, parseInt(e.count, 10)]),
    );

    const progresses = await this.progressRepository
      .createQueryBuilder('progress')
      .where('progress.organizationId = :organizationId', { organizationId })
      .andWhere('progress.studentId IN (:...studentIds)', { studentIds })
      .andWhere('progress.isCompleted = :isCompleted', { isCompleted: true })
      .select('progress.studentId', 'studentId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('progress.studentId')
      .getRawMany();
    const progressMap = new Map(
      progresses.map((p) => [p.studentId, parseInt(p.count, 10)]),
    );

    return students.map((student) => ({
      studentId: student.id,
      fullName: student.fullName,
      email: student.email,
      coursesEnrolled: enrollmentsMap.get(student.id) || 0,
      lessonsCompleted: progressMap.get(student.id) || 0,
      lastActive: student.lastLogin || null,
    }));
  }
}
