import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Semester } from './entities/semester.entity';
import { ProgramCourseMapping } from '../programs/entities/program-course-mapping.entity';
import { Course } from '../courses/entities/course.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';

@Injectable()
export class SemestersService {
  constructor(
    @InjectRepository(Semester)
    private semestersRepository: Repository<Semester>,
    @InjectRepository(ProgramCourseMapping)
    private mappingRepository: Repository<ProgramCourseMapping>,
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
  ) {}

  async findAll(organizationId: string): Promise<any[]> {
    const semesters = await this.semestersRepository.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
    const mappings = await this.mappingRepository.find({ where: { organizationId } });

    const now = new Date();
    // Lazy evaluation: auto-close semesters whose end date has passed
    for (const s of semesters) {
      if (s.endDate && new Date(s.endDate) < now && s.isActive) {
        s.isActive = false;
        await this.semestersRepository.update({ id: s.id }, { isActive: false }).catch(() => {});
      }
    }

    return semesters.map(s => {
      const courseIds = mappings
        .filter(m => m.semesterId === s.id && (!s.programId || m.programId === s.programId))
        .map(m => m.courseId);
      return {
        ...s,
        courseIds,
      };
    });
  }

  async findOne(id: string, organizationId?: string): Promise<any> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const semester = await this.semestersRepository.findOne({ where });
    if (!semester) {
      throw new NotFoundException(`Semester with ID ${id} not found`);
    }
    const resolvedOrgId = organizationId || semester.organizationId;
    const mappingWhere: any = { semesterId: id };
    if (resolvedOrgId) mappingWhere.organizationId = resolvedOrgId;
    const mappings = await this.mappingRepository.find({ where: mappingWhere });
    const courseIds = mappings
      .filter(m => !semester.programId || m.programId === semester.programId)
      .map(m => m.courseId);

    return { ...semester, courseIds };
  }

  async create(createData: Partial<Semester> & { name?: string }): Promise<Semester> {
    const semester = this.semestersRepository.create({
      ...createData,
      term: createData.name
    });
    return this.semestersRepository.save(semester);
  }

  async createBulk(createDataArray: (Partial<Semester> & { name?: string })[]): Promise<Semester[]> {
    const semesters = createDataArray.map(data => 
      this.semestersRepository.create({
        ...data,
        term: data.name
      })
    );
    return this.semestersRepository.save(semesters);
  }

  async update(id: string, organizationId: string, updateData: any): Promise<Semester> {
    const semester = await this.findOne(id, organizationId);
    if (updateData.status === 'ACTIVE' || updateData.status === 'INACTIVE') {
      semester.isActive = updateData.status === 'ACTIVE';
    }
    if (updateData.name) {
      updateData.term = updateData.name;
    }
    const updated = this.semestersRepository.merge(semester, updateData);
    return this.semestersRepository.save(updated);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const semester = await this.findOne(id, organizationId);
    await this.semestersRepository.remove(semester);
  }

  async linkCourse(organizationId: string, programId: string, semesterId: string, courseId: string) {
    const existing = await this.mappingRepository.findOne({
      where: { organizationId, programId, semesterId, courseId }
    });
    if (!existing) {
      const mapping = this.mappingRepository.create({
        organizationId,
        programId,
        semesterId,
        courseId
      });
      await this.mappingRepository.save(mapping);
    }

    // Also sync the course's primary semester and program if not set or matching
    await this.courseRepository.update(
      { id: courseId, organizationId },
      { semesterId, programId }
    );

    return { success: true };
  }

  async unlinkCourse(organizationId: string, programId: string, semesterId: string, courseId: string) {
    await this.mappingRepository.delete({
      organizationId,
      programId,
      semesterId,
      courseId
    });

    // Check if there are other semester mappings for this course
    const remainingMappings = await this.mappingRepository.find({
      where: { organizationId, courseId }
    });

    if (remainingMappings.length > 0) {
      await this.courseRepository.update(
        { id: courseId, organizationId },
        { semesterId: remainingMappings[0].semesterId, programId: remainingMappings[0].programId }
      );
    } else {
      await this.courseRepository.update(
        { id: courseId, organizationId },
        { semesterId: null as any, programId: null as any }
      );
    }

    return { success: true };
  }

  async progressCohortToNextSemester(organizationId: string, currentSemesterId: string, batchId?: string) {
    const currentSem = await this.semestersRepository.findOne({ where: { id: currentSemesterId, organizationId } });
    if (!currentSem) throw new NotFoundException('Current semester not found');

    const programId = currentSem.programId;
    if (!programId) throw new NotFoundException('Semester has no associated program');

    // Find all semesters for this program in chronological order
    const allProgramSemesters = await this.semestersRepository.find({
      where: { organizationId, programId },
      order: { createdAt: 'ASC' }
    });

    const currentIndex = allProgramSemesters.findIndex(s => s.id === currentSemesterId);
    if (currentIndex === -1 || currentIndex >= allProgramSemesters.length - 1) {
      return { message: 'This is the final semester in the program curriculum. No further semester to progress to.', progressedCount: 0 };
    }

    const nextSem = allProgramSemesters[currentIndex + 1];

    // Find courses mapped to the next semester
    const nextMappings = await this.mappingRepository.find({
      where: { organizationId, programId, semesterId: nextSem.id }
    });
    const nextCourseIds = nextMappings.map(m => m.courseId).filter(Boolean);

    // Find all students currently in this semester / batch
    const userRepo = this.semestersRepository.manager.getRepository(User);
    const enrollmentRepo = this.semestersRepository.manager.getRepository(Enrollment);

    const studentWhere: any = { organizationId, programId, userType: 'STUDENT', isDeleted: false };
    if (batchId) studentWhere.batchId = batchId;

    const students = await userRepo.find({ where: studentWhere });
    let progressedCount = 0;

    for (const student of students) {
      // Advance student's semester ID
      await userRepo.update({ id: student.id }, { semesterId: nextSem.id });

      // Automatically enroll student in the next semester's mapped courses
      for (const courseId of nextCourseIds) {
        const existing = await enrollmentRepo.findOne({
          where: { studentId: student.id, courseId, organizationId }
        });

        if (!existing) {
          const newEnrollment = enrollmentRepo.create({
            studentId: student.id,
            courseId,
            programId,
            semesterId: nextSem.id,
            batchId: student.batchId || batchId,
            organizationId,
            status: 'ACTIVE',
            paymentStatus: 'PAID',
            source: 'SEMESTER_PROGRESSION',
          });
          await enrollmentRepo.save(newEnrollment);
        }
      }
      progressedCount++;
    }

    return {
      message: `Successfully progressed ${progressedCount} student(s) to ${nextSem.name || nextSem.term || 'Next Semester'}`,
      progressedCount,
      nextSemester: nextSem
    };
  }
}
