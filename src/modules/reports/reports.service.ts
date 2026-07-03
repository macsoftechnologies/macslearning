import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Payment, PaymentDocument } from '../payment/schemas/payment.schema';
import { Enrollment, EnrollmentDocument } from '../enrollment/schemas/enrollment.schema';
import { LessonProgress, LessonProgressDocument } from '../progress/schemas/lessonProgress.schema';
import { AssessmentResult, AssessmentResultDocument } from '../results/schemas/assessmentResult.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(LessonProgress.name) private progressModel: Model<LessonProgressDocument>,
    @InjectModel(AssessmentResult.name) private resultModel: Model<AssessmentResultDocument>,
  ) {}

  async getOverviewStats(organizationId: string) {
    const totalStudents = await this.userModel.countDocuments({ organizationId, userType: 'STUDENT', status: 'ACTIVE' });
    const totalCourses = await this.courseModel.countDocuments({ organizationId, isDeleted: false });
    
    const payments = await this.paymentModel.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), status: 'COMPLETED' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]);
    
    const totalRevenue = payments.length > 0 ? payments[0].totalRevenue : 0;

    return {
      totalStudents,
      totalCourses,
      totalRevenue
    };
  }

  async getCoursePerformance(organizationId: string) {
    const courses = await this.courseModel.find({ organizationId, isDeleted: false }).select('_id title status createdAt').lean() as unknown as Array<{
      _id: any;
      title: string;
      status: string;
      createdAt: Date;
    }>;
    const courseIds = courses.map((course) => course._id);

    if (!courseIds.length) {
      return { totalCourses: 0, courses: [] };
    }

    const enrollmentStats = await this.enrollmentModel.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), courseId: { $in: courseIds } } },
      {
        $group: {
          _id: '$courseId',
          totalEnrollments: { $sum: 1 },
          activeEnrollments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0]
            }
          },
          completedEnrollments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const progressStats = await this.progressModel.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), courseId: { $in: courseIds } } },
      {
        $group: {
          _id: '$courseId',
          averageCompletion: {
            $avg: {
              $cond: ['$isCompleted', 1, 0]
            }
          }
        }
      }
    ]);

    const resultStats = await this.resultModel.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), courseId: { $in: courseIds } } },
      {
        $group: {
          _id: '$courseId',
          totalResults: { $sum: 1 },
          passedCount: {
            $sum: {
              $cond: ['$isPassed', 1, 0]
            }
          },
          averageScore: { $avg: '$percentage' }
        }
      }
    ]);

    const enrollmentByCourse = new Map(enrollmentStats.map((stat) => [stat._id.toString(), stat]));
    const progressByCourse = new Map(progressStats.map((stat) => [stat._id.toString(), stat]));
    const resultByCourse = new Map(resultStats.map((stat) => [stat._id.toString(), stat]));

    const coursePerformance = courses.map((course) => {
      const courseId = course._id.toString();
      const enrollment = enrollmentByCourse.get(courseId) || { totalEnrollments: 0, activeEnrollments: 0, completedEnrollments: 0 };
      const progress = progressByCourse.get(courseId) || { averageCompletion: 0 };
      const result = resultByCourse.get(courseId) || { totalResults: 0, passedCount: 0, averageScore: 0 };

      return {
        courseId,
        title: course.title,
        status: course.status,
        createdAt: course.createdAt,
        totalEnrollments: enrollment.totalEnrollments,
        activeEnrollments: enrollment.activeEnrollments,
        completedEnrollments: enrollment.completedEnrollments,
        averageProgress: Number((progress.averageCompletion || 0).toFixed(2)),
        averageScore: Number((result.averageScore || 0).toFixed(2)),
        passRate: result.totalResults > 0 ? Number(((result.passedCount / result.totalResults) * 100).toFixed(2)) : 0,
      };
    });

    return {
      totalCourses: courses.length,
      courses: coursePerformance,
    };
  }

  async getStudentActivity(organizationId: string) {
    const activity = await this.userModel.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), userType: 'STUDENT' } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    return activity;
  }
}
