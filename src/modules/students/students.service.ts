import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { Region } from '../regions/entities/region.entity';
import { Course } from '../courses/entities/course.entity';
import { Exam } from '../exams/entities/exam.entity';
import { Attempt } from '../exams/entities/attempt.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { LessonProgress } from '../progress/entities/lessonProgress.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Submission } from '../assignments/entities/submission.entity';
import { Program } from '../programs/entities/program.entity';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Semester } from '../semesters/entities/semester.entity';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Course) private courseRepository: Repository<Course>,
    @InjectRepository(Exam) private examRepository: Repository<Exam>,
    @InjectRepository(Attempt) private attemptRepository: Repository<Attempt>,
    @InjectRepository(Lesson) private lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonProgress) private lessonProgressRepository: Repository<LessonProgress>,
    @InjectRepository(Assignment) private assignmentRepository: Repository<Assignment>,
    @InjectRepository(Submission) private submissionRepository: Repository<Submission>,
    @InjectRepository(Program) private programRepository: Repository<Program>,
    @InjectRepository(AcademicBatch) private batchRepository: Repository<AcademicBatch>,
    @InjectRepository(Semester) private semesterRepository: Repository<Semester>,
  ) {}

  async getAllStudents(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoin(Region, 'region', 'region.id = user.regionId')
      .where('user.organizationId = :organizationId', { organizationId })
      .andWhere('user.userType = :userType', { userType: 'STUDENT' })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.mobile',
        'user.status',
        'user.createdAt',
        'region.id',
        'region.name',
      ]);

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const dataRaw = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getRawMany();
    const totalItems = await queryBuilder.getCount();

    const data = dataRaw.map((d) => ({
      _id: d.user_id,
      id: d.user_id,
      fullName: d.user_fullName,
      email: d.user_email,
      mobile: d.user_mobile,
      status: d.user_status,
      createdAt: d.user_createdAt,
      regionId: { _id: d.region_id, id: d.region_id, name: d.region_name },
    }));

    if (data.length > 0) {
      const studentIds = data.map((s) => s.id);

      const enrollments = await this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .where('enrollment.organizationId = :organizationId', {
          organizationId,
        })
        .andWhere('enrollment.studentId IN (:...studentIds)', { studentIds })
        .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
        .select('enrollment.studentId', 'studentId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('enrollment.studentId')
        .getRawMany();

      const countsMap: Record<string, number> = {};
      enrollments.forEach(
        (e) => (countsMap[e.studentId] = parseInt(e.count, 10)),
      );

      data.forEach((s) => {
        (s as any).enrolledCoursesCount = countsMap[s.id] || 0;
      });
    }

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getStudentById(studentId: string, organizationId: string) {
    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    delete (student as any).passwordHash;
    return student;
  }

  async updateStudent(
    studentId: string,
    organizationId: string,
    updateData: any,
  ) {
    await this.userRepository.update(
      { id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
      updateData,
    );
    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    delete (student as any).passwordHash;
    return student;
  }

  async deleteStudent(studentId: string, organizationId: string) {
    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.userRepository.update({ id: studentId }, { isDeleted: true });
    return { message: 'Student deleted successfully' };
  }

  async getPendingStudents(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoin(Region, 'region', 'region.id = user.regionId')
      .where('user.organizationId = :organizationId', { organizationId })
      .andWhere('user.userType = :userType', { userType: 'STUDENT' })
      .andWhere('user.status = :status', { status: 'PENDING' })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.mobile',
        'user.status',
        'user.createdAt',
        'region.id',
        'region.name',
      ]);

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const dataRaw = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getRawMany();
    const totalItems = await queryBuilder.getCount();

    const data = dataRaw.map((d) => ({
      _id: d.user_id,
      id: d.user_id,
      fullName: d.user_fullName,
      email: d.user_email,
      mobile: d.user_mobile,
      status: d.user_status,
      createdAt: d.user_createdAt,
      regionId: { _id: d.region_id, id: d.region_id, name: d.region_name },
    }));

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async approveStudent(
    studentId: string,
    adminId: string,
    organizationId?: string,
  ) {
    const whereClause: any = {
      id: studentId,
      userType: 'STUDENT',
      status: 'PENDING',
    };
    if (organizationId) whereClause.organizationId = organizationId;

    const student = await this.userRepository.findOne({ where: whereClause });
    if (!student) {
      throw new NotFoundException('Pending student not found');
    }

    student.status = 'ACTIVE';
    student.approvedBy = adminId;
    student.approvedAt = new Date();

    await this.userRepository.save(student);

    // In a real implementation, send approval email here

    return { message: 'Student approved successfully', student };
  }

  async rejectStudent(
    studentId: string,
    adminId: string,
    reason: string,
    organizationId?: string,
  ) {
    const whereClause: any = {
      id: studentId,
      userType: 'STUDENT',
      status: 'PENDING',
    };
    if (organizationId) whereClause.organizationId = organizationId;

    const student = await this.userRepository.findOne({ where: whereClause });
    if (!student) {
      throw new NotFoundException('Pending student not found');
    }

    student.status = 'REJECTED';
    student.rejectionReason = reason;
    student.rejectedBy = adminId;
    student.rejectedAt = new Date();

    await this.userRepository.save(student);

    // In a real implementation, send rejection email here

    return { message: 'Student rejected successfully', student };
  }

  async getDetailedStudentById(studentId: string, organizationId: string, facultyId?: string) {
    // 1. Fetch Student Profile
    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        status: true,
        createdAt: true,
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    // 2. Fetch Enrollments
    const enrollments = await this.enrollmentRepository.find({
      where: { studentId, organizationId, status: 'ACTIVE' }
    });

    let courseIds = enrollments.map(e => e.courseId);
    let courses: any[] = [];
    
    let totalVideosMap = new Map();
    let totalExamsMap = new Map();
    let totalAssignmentsMap = new Map();
    
    let completedVideosMap = new Map();
    let completedExamsMap = new Map();
    let completedAssignmentsMap = new Map();

    if (courseIds.length > 0) {
      const courseQuery = this.courseRepository
        .createQueryBuilder('course')
        .where('course.id IN (:...courseIds)', { courseIds })
        .andWhere('course.organizationId = :organizationId', { organizationId });

      if (facultyId) {
        courseQuery.andWhere('course.instructorIds LIKE :facultyId', { facultyId: `%${facultyId}%` });
      }
      
      courses = await courseQuery.getMany();
      
      const filteredCourseIds = courses.map(c => c.id);
      if (filteredCourseIds.length > 0) {
        // Totals
        const tVideos = await this.lessonRepository.createQueryBuilder('lesson')
          .where('lesson.courseId IN (:...filteredCourseIds)', { filteredCourseIds })
          .andWhere('lesson.type = :type', { type: 'VIDEO' })
          .select('lesson.courseId', 'courseId').addSelect('COUNT(*)', 'count').groupBy('lesson.courseId').getRawMany();
        totalVideosMap = new Map(tVideos.map(v => [v.courseId, parseInt(v.count, 10)]));

        const tExams = await this.examRepository.createQueryBuilder('exam')
          .where('exam.courseId IN (:...filteredCourseIds)', { filteredCourseIds })
          .select('exam.courseId', 'courseId').addSelect('COUNT(*)', 'count').groupBy('exam.courseId').getRawMany();
        totalExamsMap = new Map(tExams.map(e => [e.courseId, parseInt(e.count, 10)]));

        const tAssignments = await this.assignmentRepository.createQueryBuilder('assignment')
          .where('assignment.courseId IN (:...filteredCourseIds)', { filteredCourseIds })
          .select('assignment.courseId', 'courseId').addSelect('COUNT(*)', 'count').groupBy('assignment.courseId').getRawMany();
        totalAssignmentsMap = new Map(tAssignments.map(a => [a.courseId, parseInt(a.count, 10)]));

        // Completed
        const cVideos = await this.lessonProgressRepository.createQueryBuilder('lp')
          .leftJoin(Lesson, 'lesson', 'lesson.id = lp.lessonId')
          .where('lp.studentId = :studentId', { studentId })
          .andWhere('lp.courseId IN (:...filteredCourseIds)', { filteredCourseIds })
          .andWhere('lp.isCompleted = :completed', { completed: true })
          .andWhere('lesson.type = :type', { type: 'VIDEO' })
          .select('lp.courseId', 'courseId').addSelect('COUNT(DISTINCT lp.lessonId)', 'count').groupBy('lp.courseId').getRawMany();
        completedVideosMap = new Map(cVideos.map(v => [v.courseId, parseInt(v.count, 10)]));

        const cExams = await this.attemptRepository.createQueryBuilder('attempt')
          .leftJoin(Exam, 'exam', 'exam.id = attempt.examId')
          .where('attempt.studentId = :studentId', { studentId })
          .andWhere('exam.courseId IN (:...filteredCourseIds)', { filteredCourseIds })
          .select('exam.courseId', 'courseId').addSelect('COUNT(DISTINCT attempt.examId)', 'count').groupBy('exam.courseId').getRawMany();
        completedExamsMap = new Map(cExams.map(e => [e.courseId, parseInt(e.count, 10)]));

        const cAssignments = await this.submissionRepository.createQueryBuilder('sub')
          .leftJoin(Assignment, 'assignment', 'assignment.id = sub.assignmentId')
          .where('sub.studentId = :studentId', { studentId })
          .andWhere('assignment.courseId IN (:...filteredCourseIds)', { filteredCourseIds })
          .select('assignment.courseId', 'courseId').addSelect('COUNT(DISTINCT sub.assignmentId)', 'count').groupBy('assignment.courseId').getRawMany();
        completedAssignmentsMap = new Map(cAssignments.map(a => [a.courseId, parseInt(a.count, 10)]));
      }
    }

    // Fetch Programs, Batches, Semesters for these enrollments
    const programIds = [...new Set(enrollments.map(e => e.programId).filter(Boolean))];
    const batchIds = [...new Set(enrollments.map(e => e.batchId).filter(Boolean))];
    const semesterIds = [...new Set(enrollments.map(e => e.semesterId).filter(Boolean))];

    const programs = programIds.length > 0 ? await this.programRepository.createQueryBuilder('program').where('program.id IN (:...programIds)', { programIds }).getMany() : [];
    const batches = batchIds.length > 0 ? await this.batchRepository.createQueryBuilder('batch').where('batch.id IN (:...batchIds)', { batchIds }).getMany() : [];
    const semesters = semesterIds.length > 0 ? await this.semesterRepository.createQueryBuilder('semester').where('semester.id IN (:...semesterIds)', { semesterIds }).getMany() : [];

    // Filter enrollments based on courses actually found (useful if faculty filtering was applied)
    const validCourseIds = new Set(courses.map((c: any) => c.id));
    const filteredEnrollments = enrollments
      .filter(e => validCourseIds.has(e.courseId))
      .map(e => ({
        ...e,
        course: courses.find((c: any) => c.id === e.courseId),
        courseTitle: courses.find((c: any) => c.id === e.courseId)?.title,
        program: programs.find(p => p.id === e.programId) || null,
        batch: batches.find(b => b.id === e.batchId) || null,
        semester: semesters.find(s => s.id === e.semesterId) || null,
        curriculum: {
          videos: { total: totalVideosMap.get(e.courseId) || 0, completed: completedVideosMap.get(e.courseId) || 0 },
          exams: { total: totalExamsMap.get(e.courseId) || 0, completed: completedExamsMap.get(e.courseId) || 0 },
          assignments: { total: totalAssignmentsMap.get(e.courseId) || 0, completed: completedAssignmentsMap.get(e.courseId) || 0 },
        }
      }));

    // 3. Fetch Exams/Attempts only for these filtered courses
    let attempts: any[] = [];
    if (validCourseIds.size > 0) {
      attempts = await this.attemptRepository.find({
        where: { studentId, organizationId }
      });

      if (attempts.length > 0) {
        const examIds = attempts.map(a => a.examId);
        const exams = await this.examRepository
          .createQueryBuilder('exam')
          .where('exam.id IN (:...examIds)', { examIds })
          .andWhere('exam.courseId IN (:...courseIds)', { courseIds: Array.from(validCourseIds) })
          .getMany();

        const validExamIds = new Set(exams.map((e: any) => e.id));
        
        attempts = attempts
          .filter(a => validExamIds.has(a.examId))
          .map((a: any) => ({
            ...a,
            exam: exams.find((e: any) => e.id === a.examId)
          }));
      }
    }

    return {
      profile: student,
      enrollments: filteredEnrollments,
      examResults: attempts,
      stats: {
        totalCourses: filteredEnrollments.length,
        totalExamsAttempted: attempts.length,
      }
    };
  }
}
