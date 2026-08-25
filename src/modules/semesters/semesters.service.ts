import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Semester } from './entities/semester.entity';
import { ProgramCourseMapping } from '../programs/entities/program-course-mapping.entity';

@Injectable()
export class SemestersService {
  constructor(
    @InjectRepository(Semester)
    private semestersRepository: Repository<Semester>,
    @InjectRepository(ProgramCourseMapping)
    private mappingRepository: Repository<ProgramCourseMapping>,
  ) {}

  async findAll(organizationId: string): Promise<any[]> {
    const semesters = await this.semestersRepository.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
    const mappings = await this.mappingRepository.find({ where: { organizationId } });

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
    const mappings = await this.mappingRepository.find({ 
      where: organizationId ? { organizationId, semesterId: id } : { semesterId: id } 
    });
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
    return { success: true };
  }

  async unlinkCourse(organizationId: string, programId: string, semesterId: string, courseId: string) {
    await this.mappingRepository.delete({
      organizationId,
      programId,
      semesterId,
      courseId
    });
    return { success: true };
  }
}
