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
import { ProgramCourseMapping } from '../programs/entities/program-course-mapping.entity';
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
        registrationId: userEntity.registrationId || (userEntity.customProfile as any)?.registrationId || null,
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

    if (updateData.registrationId !== undefined) {
      student.registrationId = updateData.registrationId ? updateData.registrationId.trim() : null;
    }

    const userUpdateFields = ['fullName', 'mobile', 'regionId', 'ataStatus'];
    const userPayload: any = {};
    const incomingCustomProfile: any = {};

    for (const key of Object.keys(updateData)) {
      if (userUpdateFields.includes(key)) {
        userPayload[key] = updateData[key];
      } else if (key === 'customProfile' && typeof updateData[key] === 'object' && updateData[key] !== null) {
        Object.assign(incomingCustomProfile, updateData[key]);
      } else {
        incomingCustomProfile[key] = updateData[key];
      }
    }

    if (incomingCustomProfile.ataStatus && !userPayload.ataStatus) {
      userPayload.ataStatus = incomingCustomProfile.ataStatus;
    }

    if (Object.keys(userPayload).length > 0) {
      await this.userRepository.update(
        { id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
        userPayload,
      );
    }

    if (Object.keys(incomingCustomProfile).length > 0) {
      const mergedCustomProfile = {
        ...(student.customProfile || {}),
        ...incomingCustomProfile,
      };
      await this.userRepository.update({ id: studentId, organizationId }, { customProfile: mergedCustomProfile });
    }

    const updatedStudent = await this.userRepository.findOne({
      where: { id: studentId, organizationId },
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
      registrationId?: string;
      admissionNotes?: string;
      batchId?: string;
      semesterId?: string;
      programId?: string;
      deferEnrollmentUntilPurchase?: boolean;
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
      if (approvalData.registrationId) student.registrationId = approvalData.registrationId.trim();
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

    // If an explicit batchId was manually provided by admin (e.g. manual offline enrollment):
    if (approvalData?.batchId && !approvalData.batchId.startsWith('auto:') && approvalData.batchId !== 'deferred') {
      student.batchId = approvalData.batchId;
    } else {
      student.batchId = null as any;
      student.semesterId = null as any;
    }

    await this.userRepository.save(student);

    return { message: 'Student admission approved successfully. Cohort and courses will be assigned upon first course purchase.', student };
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
        registrationId: true,
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

    // Load and merge structured profile from student_profiles table
    try {
      const sp = await this.studentProfileRepository.findOne({ where: { userId: studentId } });
      if (sp) {
        (student as any).studentProfile = sp;
        (student as any).customProfile = {
          ...sp,
          ...((student as any).customProfile || {}),
        };
      }
    } catch (e) {}

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

    // 2. Auto-heal missing course enrollments for active students with program
    if (student.status === 'ACTIVE' && student.programId) {
      try {
        const existingCoursesCount = await this.enrollmentRepository
          .createQueryBuilder('e')
          .where('e.studentId = :studentId', { studentId })
          .andWhere('e.organizationId = :organizationId', { organizationId })
          .andWhere('e.courseId IS NOT NULL')
          .getCount();

        if (existingCoursesCount === 0) {
          const semesterRepo = this.dataSource.getRepository(Semester);
          const mappingRepo = this.dataSource.getRepository(ProgramCourseMapping);
          
          let activeSem = student.semesterId 
            ? await semesterRepo.findOne({ where: { id: student.semesterId, organizationId } })
            : await semesterRepo.findOne({ where: { programId: student.programId, organizationId }, order: { createdAt: 'ASC' } });
          
          if (!activeSem) {
            activeSem = await semesterRepo.findOne({ where: { organizationId }, order: { createdAt: 'ASC' } });
          }

          if (activeSem) {
            const mappings = await mappingRepo.find({
              where: [
                { programId: student.programId, semesterId: activeSem.id, organizationId },
                { semesterId: activeSem.id, organizationId }
              ]
            });
            const cIds = mappings.map(m => m.courseId).filter(Boolean);
            for (const cId of cIds) {
              const crsEnrollment = this.enrollmentRepository.create({
                studentId,
                courseId: cId,
                programId: student.programId,
                semesterId: activeSem.id,
                organizationId,
                batchId: student.batchId,
                status: 'ACTIVE',
                paymentStatus: 'PAID',
                source: 'ADMIN_ENROLL',
              });
              await this.enrollmentRepository.save(crsEnrollment);
            }
          }
        }
      } catch (err: any) {
        console.warn(`Auto-heal enrollments skipped for student ${studentId}: ${err.message}`);
      }
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
          .innerJoin(Lesson, 'lesson', 'lesson.id = lp.lessonId')
          .where('lp.studentId = :studentId', { studentId })
          .andWhere('lp.courseId IN (:...filteredCourseIds)', {
            filteredCourseIds,
          })
          .andWhere('lp.isCompleted = :completed', { completed: true })
          .andWhere('(lesson.type = :type OR lesson.videoUrl IS NOT NULL)', {
            type: 'VIDEO',
          })
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

        const matchedCourse = courses.find((c: any) => c.id === e.courseId);

        return {
          ...e,
          progressPercentage: progPct,
          courseId: matchedCourse || e.courseId,
          course: matchedCourse || null,
          courseTitle: matchedCourse?.title || '',
          thumbnailUrl: matchedCourse?.thumbnailUrl || null,
          thumbnail: matchedCourse?.thumbnailUrl || null,
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

    // Include In-Video Quiz Answers and Lesson Checkpoint Answers in examResults
    try {
      const vqAnswers = await this.dataSource.getRepository('videoquizanswers')
        .createQueryBuilder('vqa')
        .leftJoin('videoquizs', 'vq', 'vq.id = vqa.quizId')
        .leftJoin('lessons', 'l', 'l.id = vqa.lessonId')
        .where('vqa.studentId = :studentId', { studentId })
        .andWhere('vqa.organizationId = :organizationId', { organizationId })
        .select([
          'vqa.id as id',
          'vqa.isCorrect as isCorrect',
          'vqa.marks as marks',
          'vqa.createdAt as createdAt',
          'vq.questionText as questionText',
          'l.courseId as courseId',
          'l.title as lessonTitle',
        ])
        .getRawMany();

      const mappedVqAttempts = vqAnswers.map(v => ({
        id: v.id,
        status: 'SUBMITTED',
        isPassed: !!v.isCorrect,
        score: v.marks !== null && v.marks !== undefined ? v.marks : (v.isCorrect ? 1 : 0),
        marksObtained: v.marks !== null && v.marks !== undefined ? v.marks : (v.isCorrect ? 1 : 0),
        courseId: v.courseId,
        createdAt: v.createdAt,
        exam: {
          title: `[In-Video Quiz] ${v.lessonTitle ? v.lessonTitle + ': ' : ''}${v.questionText || 'Checkpoint'}`,
          totalMarks: 1,
          isFinalExam: false,
          courseId: v.courseId,
        },
      }));

      attempts = [...attempts, ...mappedVqAttempts];
    } catch (err) {
      console.warn('Video quiz answers query:', err.message);
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
