import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
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
import { OfflineGrade } from '../manual-grades/entities/offline-grade.entity';
import { StudentProfile } from './entities/student-profile.entity';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Injectable()
export class StudentsService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(StudentProfile) private studentProfileRepository: Repository<StudentProfile>,
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
    @InjectRepository(OfflineGrade) private offlineGradeRepository: Repository<OfflineGrade>,
    private enrollmentService: EnrollmentService,
  ) {}

  async getAllStudents(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search, track } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoin(Region, 'region', 'region.id = user.regionId')
      .leftJoinAndSelect('user.studentProfile', 'sp')
      .where('user.organizationId = :organizationId', { organizationId })
      .andWhere('user.userType = :userType', { userType: 'STUDENT' })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false });

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (track === 'ATA') {
      queryBuilder.andWhere('(region.isAta = :isAta OR user.ataStatus = :ataStatus)', {
        isAta: true,
        ataStatus: 'ATA',
      });
    } else if (track === 'NON_ATA') {
      queryBuilder.andWhere(
        '(region.isAta = :isAta OR region.id IS NULL OR user.ataStatus = :nonAtaStatus)',
        { isAta: false, nonAtaStatus: 'NON_ATA' },
      );
    }

    const [users, totalItems] = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const data = users.map((userEntity) => {
      const isAtaFlag = !!((userEntity as any).region?.isAta || userEntity.ataStatus === 'ATA');
      return {
        _id: userEntity.id,
        id: userEntity.id,
        fullName: userEntity.fullName,
        email: userEntity.email,
        mobile: userEntity.mobile,
        status: userEntity.status,
        ataStatus: userEntity.ataStatus || (isAtaFlag ? 'ATA' : 'NON_ATA'),
        isAtaStudent: isAtaFlag,
        interviewStatus: userEntity.interviewStatus || 'PENDING',
        interviewDetails: userEntity.interviewDetails || {},
        createdAt: userEntity.createdAt,
        customProfile: userEntity.customProfile || {},
        studentProfile: userEntity.studentProfile || null,
        regionId: (userEntity as any).region
          ? {
              _id: (userEntity as any).region.id,
              id: (userEntity as any).region.id,
              name: (userEntity as any).region.name,
              isAta: (userEntity as any).region.isAta,
            }
          : null,
      };
    });


    if (data.length > 0) {
      const studentIds = data.map((s) => s.id);

      const enrollmentsData = await this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .where('enrollment.organizationId = :organizationId', { organizationId })
        .andWhere('enrollment.studentId IN (:...studentIds)', { studentIds })
        .andWhere('enrollment.status IN (:...status)', {
          status: ['ACTIVE', 'COMPLETED'],
        })
        .getMany();

      const programIds = [
        ...new Set(enrollmentsData.map((e) => e.programId).filter(Boolean)),
      ];
      const programsMap: Record<string, number> = {};
      if (programIds.length > 0) {
        const programRows = await this.enrollmentRepository.manager
          .createQueryBuilder()
          .select(['p.id AS id', 'p.totalSubjects AS totalSubjects'])
          .from('programs', 'p')
          .where('p.id IN (:...programIds)', { programIds })
          .getRawMany();
        programRows.forEach((p) => (programsMap[p.id] = p.totalSubjects));
      }

      data.forEach((s) => {
        const sEnrollments = enrollmentsData.filter((e) => e.studentId === s.id);
        const programEnrollment = sEnrollments.find(
          (e) => e.programId && !e.courseId,
        );

        if (programEnrollment) {
          const completedCourses = sEnrollments.filter(
            (e) =>
              e.programId === programEnrollment.programId &&
              e.courseId &&
              e.status === 'COMPLETED',
          ).length;
          const totalSubjects = programsMap[programEnrollment.programId] || 30;
          (s as any).programProgress = `${completedCourses} / ${totalSubjects}`;
          (s as any).enrolledCoursesCount = completedCourses;
          (s as any).expectedGraduationDate =
            programEnrollment.expectedGraduationDate;
        } else {
          const enrolledCourses = sEnrollments.filter((e) => e.courseId).length;
          (s as any).programProgress = `${enrolledCourses} Courses`;
          (s as any).enrolledCoursesCount = enrolledCourses;
        }
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
      relations: { studentProfile: true },
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
    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const userUpdateFields = ['fullName', 'mobile', 'regionId', 'ataStatus'];
    const userPayload: any = {};
    const profilePayload: any = {};

    for (const key of Object.keys(updateData)) {
      if (userUpdateFields.includes(key)) {
        userPayload[key] = updateData[key];
      } else {
        profilePayload[key] = updateData[key];
      }
    }

    if (Object.keys(userPayload).length > 0) {
      await this.userRepository.update(
        { id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
        userPayload,
      );
    }

    if (Object.keys(profilePayload).length > 0) {
      const customProfile = student.customProfile || {};
      Object.assign(customProfile, profilePayload);
      await this.userRepository.update({ id: studentId }, { customProfile });
    }

    const updatedStudent = await this.userRepository.findOne({
      where: { id: studentId },
    });
    if (updatedStudent) {
      delete (updatedStudent as any).passwordHash;
    }
    return updatedStudent;
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
      .leftJoinAndSelect('user.studentProfile', 'sp')
      .where('user.organizationId = :organizationId', { organizationId })
      .andWhere('user.userType = :userType', { userType: 'STUDENT' })
      .andWhere('user.status = :status', { status: 'PENDING' })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false });

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [users, totalItems] = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const data = users.map((userEntity) => {
      return {
        _id: userEntity.id,
        id: userEntity.id,
        fullName: userEntity.fullName,
        email: userEntity.email,
        mobile: userEntity.mobile,
        status: userEntity.status,
        ataStatus: userEntity.ataStatus || 'NON_ATA',
        interviewStatus: userEntity.interviewStatus || 'PENDING',
        interviewDetails: userEntity.interviewDetails || {},
        createdAt: userEntity.createdAt,
        customProfile: userEntity.customProfile || {},
        studentProfile: userEntity.studentProfile || null,
        regionId: (userEntity as any).region
          ? {
              _id: (userEntity as any).region.id,
              id: (userEntity as any).region.id,
              name: (userEntity as any).region.name,
              isAta: (userEntity as any).region.isAta,
            }
          : null,
      };
    });

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async scheduleInterview(
    studentId: string,
    adminId: string,
    interviewData: {
      zoomMeetingUrl?: string;
      scheduledDate?: string;
      scheduledTime?: string;
      interviewerNotes?: string;
    },
    organizationId?: string,
  ) {
    const whereClause: any = {
      id: studentId,
      userType: 'STUDENT',
      isDeleted: false,
    };
    if (organizationId) whereClause.organizationId = organizationId;

    const student = await this.userRepository.findOne({ where: whereClause });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    student.interviewStatus = 'SCHEDULED';
    student.interviewDetails = {
      ...(student.interviewDetails || {}),
      ...interviewData,
      scheduledAt: new Date(),
      scheduledBy: adminId,
    };

    await this.userRepository.save(student);

    return { message: 'Interview scheduled successfully', student };
  }

  async confirmInterview(studentId: string) {
    const student = await this.userRepository.findOne({
      where: { id: studentId, userType: 'STUDENT' },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    student.interviewStatus = 'CONFIRMED';
    student.interviewDetails = {
      ...(student.interviewDetails || {}),
      studentAccepted: true,
      confirmedAt: new Date(),
    };

    await this.userRepository.save(student);
    return { message: 'Interview schedule confirmed successfully', student };
  }

  async approveStudent(
    studentId: string,
    adminId: string,
    organizationId?: string,
    approvalData?: {
      admissionNotes?: string;
      batchId?: string;
      semesterId?: string;
      programId?: string;
    },
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
    student.interviewStatus = 'COMPLETED';
    student.approvedBy = adminId;
    student.approvedAt = new Date();

    if (approvalData) {
      if (approvalData.programId) student.programId = approvalData.programId;
      if (approvalData.batchId) student.batchId = approvalData.batchId;
      if (approvalData.semesterId) student.semesterId = approvalData.semesterId;
      if (approvalData.admissionNotes) {
        student.interviewDetails = {
          ...(student.interviewDetails || {}),
          admissionNotes: approvalData.admissionNotes,
          completedAt: new Date(),
        };
      }
    }

    // Auto-resolve batch and exact dates from program region cohort rules
    if (!student.batchId || (approvalData?.batchId && approvalData.batchId.startsWith('auto:'))) {
      const program = student.programId ? await this.programRepository.findOne({ where: { id: student.programId } }) : null;
      let batchName = '';
      let matchedRangeObj: any = null;

      if (approvalData?.batchId && approvalData.batchId.startsWith('auto:')) {
        batchName = approvalData.batchId.replace('auto:', '').replace('(Auto)', '').trim();
      }

      const now = new Date();
      const currentMonth = now.getMonth();
      const year = now.getFullYear();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      if (program?.regionConfigs?.length) {
        const rcList = Array.isArray(program.regionConfigs) ? program.regionConfigs : [];
        const matchedRc = rcList.find((c: any) => c.hasFixedBatches && c.batchDateRanges?.length > 0) || rcList[0];

        if (matchedRc?.hasFixedBatches && matchedRc?.batchDateRanges?.length) {
          let matched = matchedRc.batchDateRanges.find((range: any) => {
            const sM = monthNames.indexOf(range.startMonth);
            const eM = monthNames.indexOf(range.endMonth);
            if (sM === -1 || eM === -1) return false;
            if (sM <= eM) return currentMonth >= sM && currentMonth <= eM;
            return currentMonth >= sM || currentMonth <= eM;
          });
          if (!matched) matched = matchedRc.batchDateRanges[0];
          matchedRangeObj = matched;

          if (!batchName && matched) {
            batchName = `${matched.startMonth.slice(0, 3)} - ${matched.endMonth.slice(0, 3)} ${year} Batch`;
          }
        }
      }

      if (!batchName) {
        const isFirstHalf = currentMonth < 6;
        batchName = isFirstHalf ? `Jan - June ${year} Batch` : `July - Dec ${year} Batch`;
      }

      // Calculate exact start and end dates for the cohort
      let batchStartDate = new Date(year, currentMonth < 6 ? 0 : 6, 1);
      let batchEndDate = new Date(year, currentMonth < 6 ? 5 : 11, currentMonth < 6 ? 30 : 31);

      if (matchedRangeObj) {
        const sM = monthNames.indexOf(matchedRangeObj.startMonth);
        const eM = monthNames.indexOf(matchedRangeObj.endMonth);
        const sD = parseInt(matchedRangeObj.startDate || '1') || 1;
        const eD = parseInt(matchedRangeObj.endDate || '30') || 30;

        if (sM !== -1 && eM !== -1) {
          if (sM <= eM) {
            batchStartDate = new Date(year, sM, sD);
            batchEndDate = new Date(year, eM, eD);
          } else {
            // Crosses calendar year (e.g. Sep to Mar)
            const isAfterStart = currentMonth >= sM;
            const startYear = isAfterStart ? year : year - 1;
            const endYear = isAfterStart ? year + 1 : year;
            batchStartDate = new Date(startYear, sM, sD);
            batchEndDate = new Date(endYear, eM, eD);
          }
        }
      }

      const orgId = student.organizationId || organizationId;
      if (orgId) {
        let batch = await this.batchRepository.findOne({
          where: { organizationId: orgId, name: batchName },
        });
        if (!batch) {
          batch = this.batchRepository.create({
            organizationId: orgId,
            name: batchName,
            programId: program?.id || student.programId || undefined,
            degreeName: program?.name || 'All Programs (Shared Intake)',
            totalSemesters: program?.totalSemesters || 6,
            courseMappings: [],
            status: 'ACTIVE',
            startDate: batchStartDate,
            endDate: batchEndDate,
          });
          await this.batchRepository.save(batch);
        } else {
          // Keep dates accurate if placeholder existed
          if (matchedRangeObj && (!batch.startDate || !batch.endDate || batch.endDate.getFullYear() - batch.startDate.getFullYear() > 1)) {
            batch.startDate = batchStartDate;
            batch.endDate = batchEndDate;
            await this.batchRepository.save(batch);
          }
        }
        student.batchId = batch.id;
      }
    }

    await this.userRepository.save(student);

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
    student.interviewStatus = 'REJECTED';
    student.rejectionReason = reason;
    student.rejectedBy = adminId;
    student.rejectedAt = new Date();

    await this.userRepository.save(student);

    return { message: 'Student rejected successfully', student };
  }

  async getDetailedStudentById(
    studentId: string,
    organizationId: string,
    facultyId?: string,
  ) {
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
        ataStatus: true,
        interviewStatus: true,
        interviewDetails: true,
        createdAt: true,
        customProfile: true,
        regionId: true,
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    // Ensure customProfile is an object
    if (typeof (student as any).customProfile === 'string') {
      try {
        (student as any).customProfile = JSON.parse(
          (student as any).customProfile,
        );
      } catch (e) {
        (student as any).customProfile = {};
      }
    } else if (!(student as any).customProfile) {
      (student as any).customProfile = {};
    }

    // Map region name if exists
    if ((student as any).regionId) {
      try {
        const regionRepo = this.dataSource.getRepository('Region');
        const region = await regionRepo.findOne({
          where: { id: (student as any).regionId },
        });
        if (region) {
          (student as any).regionId = { id: region.id, name: (region as any).name };
        }
      } catch (e) {}
    }

    // 2. Fetch Enrollments
    const enrollments = await this.enrollmentRepository.find({
      where: {
        studentId,
        organizationId,
        status: In(['ACTIVE', 'COMPLETED']),
      },
    });

    const courseIds = enrollments.map((e) => e.courseId);
    let courses: any[] = [];

    let totalVideosMap = new Map();
    let totalExamsMap = new Map();
    let totalAssignmentsMap = new Map();

    let completedVideosMap = new Map();
    let completedExamsMap = new Map();
    let completedAssignmentsMap = new Map();

    let totalLessonsMap = new Map();
    let completedLessonsMap = new Map();
    let completedLessonIdsSet = new Set<string>();

    if (courseIds.length > 0) {
      const courseQuery = this.courseRepository
        .createQueryBuilder('course')
        .where('course.id IN (:...courseIds)', { courseIds })
        .andWhere('course.organizationId = :organizationId', {
          organizationId,
        });

      if (facultyId) {
        courseQuery.andWhere('course.instructorIds LIKE :facultyId', {
          facultyId: `%${facultyId}%`,
        });
      }

      courses = await courseQuery.getMany();

      const filteredCourseIds = courses.map((c) => c.id);
      if (filteredCourseIds.length > 0) {
        const tLessons = await this.lessonRepository
          .createQueryBuilder('lesson')
          .where('lesson.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .andWhere('lesson.organizationId = :organizationId', {
            organizationId,
          })
          .andWhere('lesson.isDeleted = :isDeleted', { isDeleted: false })
          .select('lesson.courseId', 'courseId')
          .addSelect('COUNT(*)', 'count')
          .groupBy('lesson.courseId')
          .getRawMany();
        totalLessonsMap = new Map(
          tLessons.map((l) => [l.courseId, parseInt(l.count, 10)]),
        );

        const tVideos = await this.lessonRepository
          .createQueryBuilder('lesson')
          .where('lesson.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .andWhere('lesson.organizationId = :organizationId', {
            organizationId,
          })
          .andWhere('lesson.isDeleted = :isDeleted', { isDeleted: false })
          .andWhere('(lesson.type = :type OR lesson.videoUrl IS NOT NULL)', {
            type: 'VIDEO',
          })
          .select('lesson.courseId', 'courseId')
          .addSelect('COUNT(*)', 'count')
          .groupBy('lesson.courseId')
          .getRawMany();
        totalVideosMap = new Map(
          tVideos.map((v) => [v.courseId, parseInt(v.count, 10)]),
        );

        const tExams = await this.examRepository
          .createQueryBuilder('exam')
          .where('exam.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .andWhere('exam.organizationId = :organizationId', {
            organizationId,
          })
          .select('exam.courseId', 'courseId')
          .addSelect('COUNT(*)', 'count')
          .groupBy('exam.courseId')
          .getRawMany();
        totalExamsMap = new Map(
          tExams.map((e) => [e.courseId, parseInt(e.count, 10)]),
        );

        const tAssignments = await this.assignmentRepository
          .createQueryBuilder('assignment')
          .where('assignment.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .andWhere('assignment.organizationId = :organizationId', {
            organizationId,
          })
          .select('assignment.courseId', 'courseId')
          .addSelect('COUNT(*)', 'count')
          .groupBy('assignment.courseId')
          .getRawMany();
        totalAssignmentsMap = new Map(
          tAssignments.map((a) => [a.courseId, parseInt(a.count, 10)]),
        );

        const cLessons = await this.lessonProgressRepository
          .createQueryBuilder('lp')
          .where('lp.studentId = :studentId', { studentId })
          .andWhere('lp.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .andWhere('lp.isCompleted = :completed', { completed: true })
          .select('lp.courseId', 'courseId')
          .addSelect('COUNT(DISTINCT lp.lessonId)', 'count')
          .groupBy('lp.courseId')
          .getRawMany();
        completedLessonsMap = new Map(
          cLessons.map((l) => [l.courseId, parseInt(l.count, 10)]),
        );

        const allCompletedLps = await this.lessonProgressRepository.find({
          where: { studentId, isCompleted: true },
        });
        completedLessonIdsSet = new Set(
          allCompletedLps.map((p) => p.lessonId),
        );

        const cVideos = await this.lessonProgressRepository
          .createQueryBuilder('lp')
          .leftJoin(Lesson, 'lesson', 'lesson.id = lp.lessonId')
          .where('lp.studentId = :studentId', { studentId })
          .andWhere('lp.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .andWhere('lp.isCompleted = :completed', { completed: true })
          .select('lp.courseId', 'courseId')
          .addSelect('COUNT(DISTINCT lp.lessonId)', 'count')
          .groupBy('lp.courseId')
          .getRawMany();
        completedVideosMap = new Map(
          cVideos.map((v) => [v.courseId, parseInt(v.count, 10)]),
        );

        const cExams = await this.attemptRepository
          .createQueryBuilder('attempt')
          .leftJoin(Exam, 'exam', 'exam.id = attempt.examId')
          .where('attempt.studentId = :studentId', { studentId })
          .andWhere('exam.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .select('exam.courseId', 'courseId')
          .addSelect('COUNT(DISTINCT attempt.examId)', 'count')
          .groupBy('exam.courseId')
          .getRawMany();
        completedExamsMap = new Map(
          cExams.map((e) => [e.courseId, parseInt(e.count, 10)]),
        );

        const cAssignments = await this.submissionRepository
          .createQueryBuilder('sub')
          .leftJoin(Assignment, 'assignment', 'assignment.id = sub.assignmentId')
          .where('sub.studentId = :studentId', { studentId })
          .andWhere('assignment.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .select('assignment.courseId', 'courseId')
          .addSelect('COUNT(DISTINCT sub.assignmentId)', 'count')
          .groupBy('assignment.courseId')
          .getRawMany();
        completedAssignmentsMap = new Map(
          cAssignments.map((a) => [a.courseId, parseInt(a.count, 10)]),
        );
      }
    }

    // Fetch Programs, Batches, Semesters for these enrollments
    const programIds = [
      ...new Set(enrollments.map((e) => e.programId).filter(Boolean)),
    ];
    const batchIds = [
      ...new Set(enrollments.map((e) => e.batchId).filter(Boolean)),
    ];
    const semesterIds = [
      ...new Set([
        ...enrollments.map((e) => e.semesterId),
        ...courses.map((c: any) => c.semesterId),
      ].filter(Boolean)),
    ];

    const programs =
      programIds.length > 0
        ? await this.programRepository
            .createQueryBuilder('program')
            .where('program.id IN (:...programIds)', { programIds })
            .andWhere('program.organizationId = :organizationId', {
              organizationId,
            })
            .getMany()
        : [];
    const batches =
      batchIds.length > 0
        ? await this.batchRepository
            .createQueryBuilder('batch')
            .where('batch.id IN (:...batchIds)', { batchIds })
            .andWhere('batch.organizationId = :organizationId', {
              organizationId,
            })
            .getMany()
        : [];
    const semesters =
      semesterIds.length > 0
        ? await this.semesterRepository
            .createQueryBuilder('semester')
            .where('semester.id IN (:...semesterIds)', { semesterIds })
            .andWhere('semester.organizationId = :organizationId', {
              organizationId,
            })
            .getMany()
        : [];

    const offlineGrades = await this.offlineGradeRepository.find({
      where: { studentId, organizationId },
    });

    const validCourseIds = new Set(courses.map((c: any) => c.id));
    const filteredEnrollments = enrollments
      .filter((e) => validCourseIds.has(e.courseId))
      .map((e) => {
        const totalL = totalLessonsMap.get(e.courseId) || 0;
        const compL = completedLessonsMap.get(e.courseId) || 0;
        const progPct = totalL > 0 ? Math.round((compL / totalL) * 100) : 0;

        return {
          ...e,
          progressPercentage: progPct,
          course: courses.find((c: any) => c.id === e.courseId),
          courseTitle: courses.find((c: any) => c.id === e.courseId)?.title,
          program: programs.find((p) => p.id === e.programId)
            ? {
                ...programs.find((p) => p.id === e.programId),
                expectedGraduationDate:
                  enrollments.find(
                    (pe) => pe.programId === e.programId && !pe.courseId,
                  )?.expectedGraduationDate || null,
              }
            : null,
          batch: batches.find((b) => b.id === e.batchId) || null,
          semester:
            semesters.find(
              (s) =>
                s.id ===
                (e.semesterId ||
                  courses.find((c: any) => c.id === e.courseId)?.semesterId),
            ) || null,
          grade: offlineGrades.find((g) => g.courseId === e.courseId) || null,
          completedLessonIds: Array.from(completedLessonIdsSet),
          curriculum: {
            videos: {
              total: totalVideosMap.get(e.courseId) || 0,
              completed: completedVideosMap.get(e.courseId) || 0,
            },
            exams: {
              total: totalExamsMap.get(e.courseId) || 0,
              completed: completedExamsMap.get(e.courseId) || 0,
            },
            assignments: {
              total: totalAssignmentsMap.get(e.courseId) || 0,
              completed: completedAssignmentsMap.get(e.courseId) || 0,
            },
          },
        };
      });

    let attempts: any[] = [];
    if (validCourseIds.size > 0) {
      attempts = await this.attemptRepository.find({
        where: { studentId, organizationId },
      });

      if (attempts.length > 0) {
        const examIds = attempts.map((a) => a.examId);
        const exams = await this.examRepository
          .createQueryBuilder('exam')
          .where('exam.id IN (:...examIds)', { examIds })
          .andWhere('exam.courseId IN (:...courseIds)', {
            courseIds: Array.from(validCourseIds),
          })
          .getMany();

        const validExamIds = new Set(exams.map((e: any) => e.id));

        attempts = attempts
          .filter((a) => validExamIds.has(a.examId))
          .map((a: any) => ({
            ...a,
            exam: exams.find((e: any) => e.id === a.examId),
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
      },
    };
  }
}
