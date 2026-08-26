import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Semester } from './entities/semester.entity';
import { StudentCyclicProgress } from './entities/student-cyclic-progress.entity';
import { ProgramCourseMapping } from '../programs/entities/program-course-mapping.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { AssessmentResult } from '../results/entities/assessmentResult.entity';

import { Program } from '../programs/entities/program.entity';
import { Course } from '../courses/entities/course.entity';

@Injectable()
export class SemestersRolloverService {
  constructor(
    @InjectRepository(Semester)
    private semesterRepo: Repository<Semester>,
    @InjectRepository(StudentCyclicProgress)
    private cyclicProgressRepo: Repository<StudentCyclicProgress>,
    @InjectRepository(ProgramCourseMapping)
    private mappingRepo: Repository<ProgramCourseMapping>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(AssessmentResult)
    private resultsRepo: Repository<AssessmentResult>,
    @InjectRepository(Program)
    private programRepo: Repository<Program>,
    @InjectRepository(Course)
    private courseRepo: Repository<Course>,
  ) {}

  /**
   * Get preview summary of students in a semester before performing rollover
   */
  async getSemesterSummary(organizationId: string, semesterId: string) {
    const semester = await this.semesterRepo.findOne({
      where: { id: semesterId, organizationId },
    });
    if (!semester) {
      throw new NotFoundException('Semester not found');
    }

    const programId = semester.programId;
    const mappings = await this.mappingRepo.find({
      where: { organizationId, semesterId },
    });
    const courseIds = mappings.map((m) => m.courseId);

    const courses = courseIds.length > 0
      ? await this.courseRepo.find({ where: { organizationId, id: In(courseIds) } })
      : [];

    // Find all active program enrollments
    const enrollments = await this.enrollmentRepo.find({
      where: { organizationId, programId, status: 'ACTIVE' },
    });

    const studentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));

    // Fetch cyclic records
    const cyclicRecords = studentIds.length > 0
      ? await this.cyclicProgressRepo.find({
          where: { organizationId, programId, studentId: In(studentIds) },
        })
      : [];

    const summaryStudents = [];
    let totalPassedSubjects = 0;
    let totalBacklogSubjects = 0;

    for (const studentId of studentIds) {
      let progress = cyclicRecords.find((r) => r.studentId === studentId);
      const passedList = progress?.passedCourseIds ? JSON.parse(progress.passedCourseIds) : [];
      const backlogList = progress?.backlogCourseIds ? JSON.parse(progress.backlogCourseIds) : [];

      // Check results for this semester's courses
      let semPassed = 0;
      let semFailed = 0;

      for (const courseId of courseIds) {
        if (passedList.includes(courseId)) {
          semPassed++;
        } else {
          const res = await this.resultsRepo.findOne({
            where: { organizationId, studentId, courseId },
            order: { createdAt: 'DESC' },
          });
          if (res && res.isPassed) {
            semPassed++;
          } else {
            semFailed++;
          }
        }
      }

      totalPassedSubjects += semPassed;
      totalBacklogSubjects += semFailed;

      summaryStudents.push({
        studentId,
        currentSemesterNumber: progress?.currentSemesterNumber || 1,
        currentCycleRound: progress?.currentCycleRound || 1,
        semPassed,
        semFailed,
        existingBacklogsCount: backlogList.length,
      });
    }

    return {
      semester: {
        id: semester.id,
        name: semester.name,
        term: semester.term,
        programId: semester.programId,
      },
      coursesCount: courses.length,
      courses: courses.map((c) => ({ id: c.id, title: c.title })),
      totalEnrolledStudents: studentIds.length,
      totalPassedSubjects,
      totalBacklogSubjects,
      students: summaryStudents,
    };
  }

  /**
   * Execute manual semester close & rollover for an active semester
   */
  async executeSemesterRollover(organizationId: string, semesterId: string) {
    const semester = await this.semesterRepo.findOne({
      where: { id: semesterId, organizationId },
    });
    if (!semester) {
      throw new NotFoundException('Semester not found');
    }

    const program = semester.programId
      ? await this.programRepo.findOne({ where: { id: semester.programId, organizationId } })
      : null;

    const totalSemestersInCycle = program?.totalSemesters || 6;

    const mappings = await this.mappingRepo.find({
      where: { organizationId, semesterId },
    });
    const courseIds = mappings.map((m) => m.courseId);

    // Find all active program enrollments
    const enrollments = await this.enrollmentRepo.find({
      where: { organizationId, programId: semester.programId, status: 'ACTIVE' },
    });

    const studentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));
    const rolloverResults = [];

    for (const studentId of studentIds) {
      let progress = await this.cyclicProgressRepo.findOne({
        where: { organizationId, programId: semester.programId, studentId },
      });

      if (!progress) {
        progress = this.cyclicProgressRepo.create({
          organizationId,
          programId: semester.programId,
          studentId,
          currentCycleRound: 1,
          currentSemesterNumber: 1,
          passedCourseIds: JSON.stringify([]),
          backlogCourseIds: JSON.stringify([]),
          status: 'IN_PROGRESS',
        });
      }

      let passedList: string[] = progress.passedCourseIds ? JSON.parse(progress.passedCourseIds) : [];
      let backlogList: string[] = progress.backlogCourseIds ? JSON.parse(progress.backlogCourseIds) : [];

      // Evaluate each course in this semester
      for (const courseId of courseIds) {
        if (!passedList.includes(courseId)) {
          const res = await this.resultsRepo.findOne({
            where: { organizationId, studentId, courseId },
            order: { createdAt: 'DESC' },
          });

          if (res && (res.isPassed || res.percentage >= (semester.passingPercentage || 50))) {
            passedList.push(courseId);
            backlogList = backlogList.filter((id) => id !== courseId);
          } else {
            if (!backlogList.includes(courseId)) {
              backlogList.push(courseId);
            }
          }
        }
      }

      // Advance semester index
      let newSemNumber = progress.currentSemesterNumber + 1;
      let newCycleRound = progress.currentCycleRound;
      let newStatus = progress.status;

      if (newSemNumber > totalSemestersInCycle) {
        // Carousel completed full circle! Loop back to Semester 1 for Round 2 (Backlog clearance)
        newSemNumber = 1;
        newCycleRound += 1;
        if (backlogList.length > 0) {
          newStatus = 'CYCLE_REPEAT';
        } else {
          newStatus = 'COMPLETED';
        }
      }

      progress.passedCourseIds = JSON.stringify(passedList);
      progress.backlogCourseIds = JSON.stringify(backlogList);
      progress.currentSemesterNumber = newSemNumber;
      progress.currentCycleRound = newCycleRound;
      progress.status = newStatus;

      await this.cyclicProgressRepo.save(progress);

      // Sync enrollment currentSemesterIndex
      await this.enrollmentRepo.update(
        { organizationId, studentId, programId: semester.programId },
        { currentSemesterIndex: newSemNumber }
      );

      rolloverResults.push({
        studentId,
        previousSemester: progress.currentSemesterNumber,
        newSemesterNumber: newSemNumber,
        cycleRound: newCycleRound,
        passedCount: passedList.length,
        backlogsCount: backlogList.length,
        status: newStatus,
      });
    }

    return {
      success: true,
      message: `Semester rollover executed successfully for ${studentIds.length} students.`,
      processedCount: studentIds.length,
      details: rolloverResults,
    };
  }

  /**
   * Get student's detailed cyclic carousel status
   */
  async getStudentCyclicStatus(organizationId: string, studentId: string, programId?: string) {
    try {
      let resolvedOrgId = organizationId;
      let resolvedProgId = programId;

      // 1. If programId or organizationId is missing, check enrollment
      if (!resolvedProgId || !resolvedOrgId) {
        const enrollment = await this.enrollmentRepo.findOne({
          where: resolvedOrgId
            ? { organizationId: resolvedOrgId, studentId }
            : { studentId },
          order: { createdAt: 'DESC' },
        });
        if (enrollment) {
          if (!resolvedOrgId) resolvedOrgId = enrollment.organizationId;
          if (!resolvedProgId) resolvedProgId = enrollment.programId;
        }
      }

      // 2. Find cyclic progress record
      const whereProgress: any = { studentId };
      if (resolvedOrgId) whereProgress.organizationId = resolvedOrgId;
      if (resolvedProgId) whereProgress.programId = resolvedProgId;

      const progress = await this.cyclicProgressRepo.findOne({
        where: whereProgress,
        order: { updatedAt: 'DESC' },
      });

      // 3. Find program info safely
      const program = (resolvedProgId && resolvedOrgId)
        ? await this.programRepo.findOne({
            where: { id: resolvedProgId, organizationId: resolvedOrgId },
          })
        : (resolvedProgId ? await this.programRepo.findOne({ where: { id: resolvedProgId } }) : null);


      // Safe JSON parsing helper
      const parseIds = (raw: any): string[] => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            return [];
          }
        }
        return [];
      };

      const passedIds = parseIds(progress?.passedCourseIds);
      const backlogIds = parseIds(progress?.backlogCourseIds);

      const passedCourses = (passedIds.length > 0 && resolvedOrgId)
        ? await this.courseRepo.find({ where: { organizationId: resolvedOrgId, id: In(passedIds) } })
        : [];

      const backlogCourses = (backlogIds.length > 0 && resolvedOrgId)
        ? await this.courseRepo.find({ where: { organizationId: resolvedOrgId, id: In(backlogIds) } })
        : [];

      return {
        success: true,
        studentId,
        programId: resolvedProgId || '',
        programName: program?.name || 'Program',
        totalSubjects: program?.totalSubjects || 30,
        totalSemesters: program?.totalSemesters || 6,
        currentSemesterIndex: progress?.currentSemesterNumber || 1,
        currentSemesterNumber: progress?.currentSemesterNumber || 1,
        currentCycleRound: progress?.currentCycleRound || 1,
        passedCount: passedIds.length,
        backlogCount: backlogIds.length,
        status: progress?.status || 'IN_PROGRESS',
        cyclicProgress: progress || {
          currentCycleRound: 1,
          currentSemesterNumber: 1,
          status: 'IN_PROGRESS',
        },
        passedCourses: passedCourses.map((c) => ({ id: c.id, title: c.title, credits: c.credits })),
        backlogCourses: backlogCourses.map((c) => ({ id: c.id, title: c.title, credits: c.credits })),
        canRetakeBacklogs: (progress?.currentCycleRound || 1) > 1,
      };
    } catch (err) {
      // Fallback graceful response to never break student profile
      return {
        success: true,
        studentId,
        programId: programId || '',
        programName: 'Degree Program',
        totalSubjects: 30,
        totalSemesters: 6,
        currentSemesterIndex: 1,
        currentSemesterNumber: 1,
        currentCycleRound: 1,
        passedCount: 0,
        backlogCount: 0,
        status: 'IN_PROGRESS',
        cyclicProgress: {
          currentCycleRound: 1,
          currentSemesterNumber: 1,
          status: 'IN_PROGRESS',
        },
        passedCourses: [],
        backlogCourses: [],
        canRetakeBacklogs: false,
      };
    }
  }

}
