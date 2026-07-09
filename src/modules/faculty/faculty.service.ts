import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Submission } from '../assignments/entities/submission.entity';
import { Exam } from '../exams/entities/exam.entity';
import { Attempt } from '../exams/entities/attempt.entity';
import { Thread } from '../discussion/entities/thread.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FacultyService {
  constructor(
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Exam) private examRepository: Repository<Exam>,
    @InjectRepository(Attempt) private attemptRepository: Repository<Attempt>,
    @InjectRepository(Thread) private threadRepository: Repository<Thread>,
  ) {}

  async getDashboardStats(organizationId: string, facultyId: string) {
    // 1. Get courses taught by this faculty
    const courses = await this.courseRepository
      .createQueryBuilder('course')
      .where('course.organizationId = :organizationId', { organizationId })
      .andWhere('course.instructorIds LIKE :facultyId', {
        facultyId: `%${facultyId}%`,
      })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false })
      .getMany();

    const courseIds = courses.map((c) => c.id);

    if (courseIds.length === 0) {
      return {
        courses: [],
        totalStudents: 0,
        pendingGrading: 0,
        publishedCourses: 0,
        upcomingDeadlines: [],
        unansweredQuestions: 0,
      };
    }

    // 2. Get total unique students
    const uniqueStudentsResult = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .where('enrollment.organizationId = :organizationId', { organizationId })
      .andWhere('enrollment.courseId IN (:...courseIds)', { courseIds })
      .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
      .select('COUNT(DISTINCT enrollment.studentId)', 'count')
      .getRawOne();
    const totalStudents = parseInt(uniqueStudentsResult?.count || '0', 10);

    const courseEnrollments = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .where('enrollment.organizationId = :organizationId', { organizationId })
      .andWhere('enrollment.courseId IN (:...courseIds)', { courseIds })
      .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
      .select('enrollment.courseId', 'courseId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('enrollment.courseId')
      .getRawMany();

    const enrollmentMap = new Map(
      courseEnrollments.map((e) => [e.courseId, parseInt(e.count, 10)]),
    );

    // 3. Get pending grading
    const assignments = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.organizationId = :organizationId', { organizationId })
      .andWhere('assignment.courseId IN (:...courseIds)', { courseIds })
      .getMany();
    const assignmentIds = assignments.map((a) => a.id);

    let pendingSubmissionsCount = 0;
    if (assignmentIds.length > 0) {
      pendingSubmissionsCount = await this.submissionRepository
        .createQueryBuilder('sub')
        .where('sub.organizationId = :organizationId', { organizationId })
        .andWhere('sub.assignmentId IN (:...assignmentIds)', { assignmentIds })
        .andWhere('sub.status = :status', { status: 'PENDING' })
        .getCount();
    }

    const exams = await this.examRepository
      .createQueryBuilder('exam')
      .where('exam.organizationId = :organizationId', { organizationId })
      .andWhere('exam.courseId IN (:...courseIds)', { courseIds })
      .getMany();
    const examIds = exams.map((e) => e.id);

    let pendingAttemptsCount = 0;
    if (examIds.length > 0) {
      pendingAttemptsCount = await this.attemptRepository
        .createQueryBuilder('attempt')
        .where('attempt.organizationId = :organizationId', { organizationId })
        .andWhere('attempt.examId IN (:...examIds)', { examIds })
        .andWhere('attempt.status = :status', { status: 'PENDING_REVIEW' })
        .getCount();
    }

    // 4. Upcoming Deadlines
    const upcomingDeadlines = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.organizationId = :organizationId', { organizationId })
      .andWhere('assignment.courseId IN (:...courseIds)', { courseIds })
      .andWhere('assignment.dueDate >= :now', { now: new Date() })
      .orderBy('assignment.dueDate', 'ASC')
      .limit(5)
      .getMany();

    // 5. Unanswered Questions (discussions)
    const unansweredQuestions = await this.threadRepository
      .createQueryBuilder('thread')
      .where('thread.organizationId = :organizationId', { organizationId })
      .andWhere('thread.courseId IN (:...courseIds)', { courseIds })
      .andWhere('thread.replyCount = 0')
      .getCount();

    return {
      courses: courses.map((c) => ({
        _id: c.id,
        title: c.title,
        status: c.status,
        enrolledCount: enrollmentMap.get(c.id) || 0,
      })),
      totalStudents,
      pendingGrading: pendingSubmissionsCount + pendingAttemptsCount,
      publishedCourses: courses.filter((c) => c.status === 'PUBLISHED').length,
      upcomingDeadlines: upcomingDeadlines.map((a) => ({
        _id: a.id,
        title: a.title,
        dueDate: a.dueDate,
        courseId: a.courseId,
      })),
      unansweredQuestions,
    };
  }

  async getGradingQueue(organizationId: string, facultyId: string) {
    const courses = await this.courseRepository
      .createQueryBuilder('course')
      .where('course.organizationId = :organizationId', { organizationId })
      .andWhere('course.instructorIds LIKE :facultyId', {
        facultyId: `%${facultyId}%`,
      })
      .andWhere('course.isDeleted = :isDeleted', { isDeleted: false })
      .getMany();

    const courseIds = courses.map((c) => c.id);
    const courseMap: Record<string, string> = {};
    courses.forEach((c) => (courseMap[c.id] = c.title));

    if (courseIds.length === 0) return [];

    const assignments = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.organizationId = :organizationId', { organizationId })
      .andWhere('assignment.courseId IN (:...courseIds)', { courseIds })
      .getMany();
    const assignmentIds = assignments.map((a) => a.id);
    const assignmentMap: Record<string, any> = {};
    assignments.forEach((a) => (assignmentMap[a.id] = a));

    let submissions: any[] = [];
    if (assignmentIds.length > 0) {
      submissions = await this.submissionRepository
        .createQueryBuilder('sub')
        .leftJoin(User, 'student', 'student.id = sub.studentId')
        .where('sub.organizationId = :organizationId', { organizationId })
        .andWhere('sub.assignmentId IN (:...assignmentIds)', { assignmentIds })
        .andWhere('sub.status = :status', { status: 'PENDING' })
        .select([
          'sub.*',
          'student.fullName as student_fullName',
          'student.firstName as student_firstName',
          'student.lastName as student_lastName',
        ])
        .orderBy('sub.createdAt', 'ASC')
        .getRawMany();
    }

    const exams = await this.examRepository
      .createQueryBuilder('exam')
      .where('exam.organizationId = :organizationId', { organizationId })
      .andWhere('exam.courseId IN (:...courseIds)', { courseIds })
      .getMany();
    const examIds = exams.map((e) => e.id);
    const examMap: Record<string, any> = {};
    exams.forEach((e) => (examMap[e.id] = e));

    let attempts: any[] = [];
    if (examIds.length > 0) {
      attempts = await this.attemptRepository
        .createQueryBuilder('attempt')
        .leftJoin(User, 'student', 'student.id = attempt.studentId')
        .where('attempt.organizationId = :organizationId', { organizationId })
        .andWhere('attempt.examId IN (:...examIds)', { examIds })
        .andWhere('attempt.status = :status', { status: 'PENDING_REVIEW' })
        .select([
          'attempt.*',
          'student.fullName as student_fullName',
          'student.firstName as student_firstName',
          'student.lastName as student_lastName',
        ])
        .orderBy('attempt.createdAt', 'ASC')
        .getRawMany();
    }

    const queue = [
      ...submissions.map((s) => ({
        _id: s.id,
        type: 'assignment',
        title: assignmentMap[s.assignmentId]?.title,
        courseName: courseMap[assignmentMap[s.assignmentId]?.courseId],
        studentName:
          `${s.student_firstName || ''} ${s.student_lastName || ''}`.trim() ||
          s.student_fullName ||
          'Unknown',
        submittedAt: s.createdAt,
        assignmentId: s.assignmentId,
      })),
      ...attempts.map((a) => ({
        _id: a.id,
        type: 'exam',
        title: examMap[a.examId]?.title,
        courseName: courseMap[examMap[a.examId]?.courseId],
        studentName:
          `${a.student_firstName || ''} ${a.student_lastName || ''}`.trim() ||
          a.student_fullName ||
          'Unknown',
        submittedAt: a.createdAt,
        examId: a.examId,
      })),
    ].sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
    );

    return queue;
  }
}
