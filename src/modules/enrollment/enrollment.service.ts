import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
import { Program } from '../programs/entities/program.entity';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';
import { Semester } from '../semesters/entities/semester.entity';
import { RegionConfig } from '../regions/entities/region-config.entity';
import { RegionCohort } from '../academic-batches/entities/batch.entity';

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
    @InjectRepository(Program) private programRepository: Repository<Program>,
    @InjectRepository(AcademicBatch) private batchRepository: Repository<AcademicBatch>,
    @InjectRepository(Semester) private semesterRepository: Repository<Semester>,
    @InjectRepository(RegionConfig) private regionConfigRepository: Repository<RegionConfig>,
    @InjectRepository(RegionCohort) private regionCohortRepository: Repository<RegionCohort>,
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

    // 1. Check regional price first
    if (regionId && course.regionalPrices) {
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
        if (rp && rp.price !== undefined && rp.price !== null) {
          amount = parseFloat(rp.price) || 0;
          isPaid = true;
        }
      }
    }

    // 2. Fallback to base pricing if no regional price matched
    if (!isPaid) {
      const pricing = course.pricing;
      if (pricing?.isPaid) {
        isPaid = true;
        amount = parseFloat(pricing.amount) || 0;
      } else if ((course as any).price) {
        isPaid = true;
        amount = parseFloat((course as any).price) || 0;
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

    // Link to program if applicable
    let batchId: string | undefined = undefined;
    if (course.programId) {
      const programEnrollment = await this.enrollmentRepository.findOne({
        where: {
          organizationId,
          studentId,
          programId: course.programId,
          status: 'ACTIVE',
        },
      });
      // We assume courseId IS NULL is the program enrollment, but simply finding any active enrollment 
      // for the program is enough to grab the batchId.
      if (programEnrollment) {
        batchId = programEnrollment.batchId;
      }
    }

    const enrollment = this.enrollmentRepository.create({
      organizationId,
      studentId,
      courseId,
      programId: course.programId,
      semesterId: course.semesterId,
      batchId,
      paymentStatus: (isPaid && amount > 0) ? 'PAID' : 'NOT_APPLICABLE',
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

  async enrollInProgram(
    studentId: string,
    organizationId: string,
    programId: string,
    batchId?: string,
    regionId?: string,
    selectedCourseIds?: string[],
  ) {
    const program = await this.programRepository.findOne({
      where: { id: programId, organizationId }
    });
    
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    if (!selectedCourseIds || !selectedCourseIds.length) {
      throw new BadRequestException('No courses selected for this program');
    }

    // 1. Fetch all selected courses for this program
    const courses = await this.courseRepository.find({
      where: { organizationId, id: In(selectedCourseIds), status: 'PUBLISHED' },
    });
    
    if (!courses.length) {
      throw new BadRequestException('No valid courses found for this program');
    }

    // 2. Determine expiration and graduation date
    let expiresAt: Date | undefined = undefined;
    let expectedGraduationDate: Date | undefined = undefined;
    
    // We are no longer relying on course validity for programs. 
    // Programs have maxDurationYears.
    if (program.maxDurationYears && program.maxDurationYears > 0) {
      const gradDate = new Date();
      gradDate.setFullYear(gradDate.getFullYear() + program.maxDurationYears);
      gradDate.setDate(gradDate.getDate() - 1);
      expectedGraduationDate = gradDate;
    }

    // Region Cohort Rules Logic
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-11
    const currentYear = currentDate.getFullYear();
    const currentDay = currentDate.getDate();

    let regionNameRaw = '';
    let regionNameStr = '';
    if (regionId) {
      try {
        const regionObj = await this.batchRepository.manager.query(`SELECT name FROM regions WHERE id = ?`, [regionId]);
        if (regionObj && regionObj.length > 0) {
          regionNameRaw = regionObj[0].name;
          regionNameStr = ` - ${regionNameRaw}`;
        }
      } catch (err) {}
    }

    let autoBatchId: string | undefined = undefined;

    const regionConfigs = await this.batchRepository.manager.query(
      `SELECT * FROM region_configs WHERE programId = ? AND regionName = ?`,
      [programId, regionNameRaw]
    );

    const config = regionConfigs.length > 0 ? regionConfigs[0] : null;

    if (config && config.customDurationYears) {
      const gradDate = new Date();
      gradDate.setFullYear(gradDate.getFullYear() + config.customDurationYears);
      gradDate.setDate(gradDate.getDate() - 1);
      expectedGraduationDate = gradDate;
    }

    if (!config || !config.hasFixedBatches) {
      // Rolling Admissions: No batch generated.
      autoBatchId = undefined;
    } else {
      // Fixed Batches: Use the configured batchDateRanges
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      let batchRanges = [];
      try {
        if (typeof config.batchDateRanges === 'string') {
           batchRanges = JSON.parse(config.batchDateRanges);
        } else {
           batchRanges = config.batchDateRanges || [];
        }
      } catch(e) {}

      let targetRange = null;

      for (const range of batchRanges) {
        const startMonthIdx = monthNames.indexOf(range.startMonth);
        const endMonthIdx = monthNames.indexOf(range.endMonth);
        const startDateInt = parseInt(range.startDate || '1');
        const endDateInt = parseInt(range.endDate || '31');
        
        let fallsIn = false;
        
        if (startMonthIdx <= endMonthIdx) {
           if (currentMonth > startMonthIdx && currentMonth < endMonthIdx) {
              fallsIn = true;
           } else if (currentMonth === startMonthIdx && currentMonth === endMonthIdx) {
              if (currentDay >= startDateInt && currentDay <= endDateInt) fallsIn = true;
           } else if (currentMonth === startMonthIdx) {
              if (currentDay >= startDateInt) fallsIn = true;
           } else if (currentMonth === endMonthIdx) {
              if (currentDay <= endDateInt) fallsIn = true;
           }
        }
        
        if (fallsIn) {
          targetRange = { ...range, startMonthIdx, endMonthIdx, startDateInt, endDateInt };
          break;
        }
      }

      if (!targetRange && batchRanges.length > 0) {
        const r = batchRanges[0];
        targetRange = { ...r, startMonthIdx: monthNames.indexOf(r.startMonth), endMonthIdx: monthNames.indexOf(r.endMonth), startDateInt: parseInt(r.startDate || '1'), endDateInt: parseInt(r.endDate || '31') };
      }

      if (targetRange) {
        const startShort = targetRange.startMonth.substring(0,3);
        const endShort = targetRange.endMonth.substring(0,3);
        const batchName = `${startShort}-${endShort} ${currentYear}${regionNameStr}`;
        
        let activeBatch = await this.batchRepository.findOne({
          where: { organizationId, programId, name: batchName }
        });
        
        if (!activeBatch) {
          const startDateObj = new Date(currentYear, targetRange.startMonthIdx, targetRange.startDateInt);
          
          let durationYears = program.maxDurationYears || 0;
          if (config && config.customDurationYears) {
             durationYears = config.customDurationYears;
          }
          
          const batchEndDateObj = new Date(startDateObj);
          batchEndDateObj.setFullYear(batchEndDateObj.getFullYear() + durationYears);
          batchEndDateObj.setDate(batchEndDateObj.getDate() - 1);
          
          activeBatch = this.batchRepository.create({
            organizationId, programId, name: batchName,
            degreeName: program.name || 'Program',
            totalSemesters: 0, courseMappings: {},
            startDate: startDateObj, endDate: batchEndDateObj,
            status: 'ACTIVE', currentEnrolledCount: 0
          });
          await this.batchRepository.save(activeBatch);
        }
        autoBatchId = activeBatch.id;
        
        // Sync the student's graduation date directly with the batch's end date
        expectedGraduationDate = activeBatch.endDate;
      }
    }

    // 3. Create a SINGLE program enrollment
    const programEnrollment = this.enrollmentRepository.create({
      organizationId,
      studentId,
      courseId: undefined,
      programId,
      batchId: autoBatchId,
      semesterId: undefined,
      paymentStatus: 'NOT_APPLICABLE',
      source: 'SELF_ENROLL',
      paymentModel: 'PAY_PER_COURSE',
      expectedGraduationDate,
      paymentId: undefined,
      expiresAt,
    });

    await this.enrollmentRepository.save(programEnrollment);

    // 4. Update enrolled count for program (if tracking on program level)
    // Currently no enrolledCount on program, we could add it later if needed.

    let enrollmentsCount = 1;

    let totalAmountPaid = 0;

    // 5. Create Course Enrollments for selected courses
    if (selectedCourseIds && selectedCourseIds.length > 0) {
      for (const courseId of selectedCourseIds) {
        // verify course is in program
        const c = courses.find(c => c.id === courseId);
        if (c) {
          let amount = 0;
          let isPaid = false;

          // 1. Check regional price
          if (regionId && c.regionalPrices) {
            let parsedPrices = c.regionalPrices;
            if (typeof parsedPrices === 'string') {
              try { parsedPrices = JSON.parse(parsedPrices); } catch (e) {}
            }
            if (Array.isArray(parsedPrices)) {
              const rp = parsedPrices.find(
                (p: any) =>
                  p.regionId === regionId ||
                  (p.regionId && p.regionId._id === regionId) ||
                  (p.regionId && p.regionId.id === regionId),
              );
              if (rp && rp.price !== undefined && rp.price !== null) {
                amount = parseFloat(rp.price) || 0;
                isPaid = true;
              }
            }
          }

          // 2. Fallback to base price
          if (!isPaid) {
            const pricing = c.pricing;
            if (pricing?.isPaid) {
              isPaid = true;
              amount = parseFloat(pricing.amount) || 0;
            } else if ((c as any).price) {
              isPaid = true;
              amount = parseFloat((c as any).price) || 0;
            }
          }

          let paymentRecord = null;
          if (isPaid && amount > 0) {
            const dummyPaymentId = `DUMMY-${uuidv4()}`;
            const payment = this.paymentRepository.create({
              organizationId,
              studentId,
              courseId: c.id,
              amount,
              dummyPaymentId,
              status: 'COMPLETED',
              isPaid: true,
              paidAt: new Date(),
              createdBy: studentId,
            });
            paymentRecord = await this.paymentRepository.save(payment);
            totalAmountPaid += amount;
          }

          const courseEnrollment = this.enrollmentRepository.create({
            organizationId,
            studentId,
            courseId: c.id,
            programId,
            batchId: autoBatchId,
            semesterId: c.semesterId || undefined,
            paymentStatus: (isPaid && amount > 0) ? 'PAID' : 'NOT_APPLICABLE',
            source: 'SELF_ENROLL',
            paymentModel: 'PAY_PER_COURSE',
            expectedGraduationDate: undefined,
            paymentId: paymentRecord ? paymentRecord.id : undefined,
            expiresAt: undefined,
          });
          await this.enrollmentRepository.save(courseEnrollment);
          
          await this.courseRepository.update(
            { id: c.id, organizationId },
            { enrolledCount: (c.enrolledCount || 0) + 1 },
          );
          
          enrollmentsCount++;
        }
      }
    }

    // 5. Notify student
    try {
      await this.notificationsService.createNotification(
        organizationId,
        studentId,
        'Enrolled in Program',
        `You have been successfully enrolled in ${program.name || 'the program'}!`,
        'ENROLLMENT',
        `/student/programs/${programId}`,
      );
    } catch (e) {}

    return {
      success: true,
      dummyPaymentId: null,
      amount: totalAmountPaid,
      enrollmentsCount,
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
    const { page = 1, limit = 10, search, batchId } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('enrollment.batch', 'batch')
      .where('enrollment.organizationId = :organizationId', { organizationId });

    if (batchId) {
      queryBuilder.andWhere('enrollment.batchId = :batchId', { batchId });
    }

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
      .andWhere('enrollment.courseId IS NOT NULL')
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

    const programIds = [...new Set(mappedEnrollments.map(e => e.programId).filter(Boolean))];
    const batchIds = [...new Set(mappedEnrollments.map(e => e.batchId).filter(Boolean))];
    const semesterIds = [...new Set(mappedEnrollments.map(e => e.semesterId).filter(Boolean))];

    const programs = programIds.length > 0 ? await this.programRepository.createQueryBuilder('program').where('program.id IN (:...programIds)', { programIds }).andWhere('program.organizationId = :organizationId', { organizationId }).getMany() : [];
    const batches = batchIds.length > 0 ? await this.batchRepository.createQueryBuilder('batch').where('batch.id IN (:...batchIds)', { batchIds }).andWhere('batch.organizationId = :organizationId', { organizationId }).getMany() : [];
    const semesters = semesterIds.length > 0 ? await this.semesterRepository.createQueryBuilder('semester').where('semester.id IN (:...semesterIds)', { semesterIds }).andWhere('semester.organizationId = :organizationId', { organizationId }).getMany() : [];

    return mappedEnrollments.map((e) => {
      const cId = e.courseId.id || '';
      const total = totalLessonsMap[cId] || 0;
      const completed = completedMap[cId] || 0;
      return {
        ...e,
        program: programs.find(p => p.id === e.programId) || null,
        batch: batches.find(b => b.id === e.batchId) || null,
        semester: semesters.find(s => s.id === e.semesterId) || null,
        progressPercentage:
          total === 0 ? 0 : Math.round((completed / total) * 100),
      };
    });
  }

  async getStudentPrograms(studentId: string, organizationId: string) {
    const enrollments = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .leftJoin(Program, 'program', 'program.id = enrollment.programId')
      .where('enrollment.studentId = :studentId', { studentId })
      .andWhere('enrollment.organizationId = :organizationId', { organizationId })
      .andWhere('enrollment.courseId IS NULL')
      .select([
        'enrollment.*',
        'program.id as program_id',
        'program.name as program_name',
        'program.description as program_description',
        'program.totalSubjects as program_totalSubjects',
        'program.maxDurationYears as program_maxDurationYears',
        'program.degreeTitle as program_degreeTitle',
      ])
      .orderBy('enrollment.createdAt', 'DESC')
      .getRawMany();

    const mappedEnrollments = enrollments.map((e) => ({
      ...e,
      program: {
        id: e.program_id,
        name: e.program_name,
        description: e.program_description,
        totalSubjects: e.program_totalSubjects,
        maxDurationYears: e.program_maxDurationYears,
        degreeTitle: e.program_degreeTitle,
      },
    }));

    // Find completed courses for these programs
    const programIds = mappedEnrollments.map(e => e.programId).filter(Boolean);
    if (programIds.length === 0) return mappedEnrollments;

    // We count how many course enrollments have status = 'COMPLETED' for this student/program
    const completedCourses = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .where('enrollment.studentId = :studentId', { studentId })
      .andWhere('enrollment.organizationId = :organizationId', { organizationId })
      .andWhere('enrollment.courseId IS NOT NULL')
      .andWhere('enrollment.programId IN (:...programIds)', { programIds })
      .andWhere('enrollment.status = :status', { status: 'COMPLETED' })
      .select('enrollment.programId', 'programId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('enrollment.programId')
      .getRawMany();

    const completedMap: Record<string, number> = {};
    for (const row of completedCourses) {
      completedMap[row.programId] = parseInt(row.count, 10);
    }

    return mappedEnrollments.map((e) => {
      const completed = completedMap[e.programId] || 0;
      const total = e.program.totalSubjects || 30;
      return {
        ...e,
        completedCourses: completed,
        progressPercentage: total === 0 ? 0 : Math.round((completed / total) * 100),
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
        status: In(['ACTIVE', 'COMPLETED']),
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

  private async determineBatchForRegion(organizationId: string, programId: string, regionId: string) {
    // 1. Fetch Region Config for this program/region
    const config = await this.regionConfigRepository.findOne({
      where: { organizationId, programId, regionName: regionId }
    });

    // If no config or rolling admissions (no fixed batches), return null batch
    if (!config || !config.hasFixedBatches) {
      return null;
    }

    // 2. Determine current date and find matching date range
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const currentYear = new Date().getFullYear();
    
    // Check if there is an active RegionCohort for this config and year (Simplified lookup)
    let activeCohort = await this.regionCohortRepository.findOne({
      where: { organizationId, regionConfigId: config.id } // Ideally filter by active date range
    });

    // 3. Dynamic Batch Creation (First Person Rule)
    if (!activeCohort) {
      const cohortName = `${currentMonth} ${currentYear} Batch`;
      const newCohort = this.regionCohortRepository.create({
        organizationId,
        name: cohortName,
        regionConfigId: config.id,
        startDate: new Date(),
        // Deadline calculation would go here based on config.customDurationYears or program default
      });
      activeCohort = await this.regionCohortRepository.save(newCohort);
    }

    return activeCohort.id;
  }
}
