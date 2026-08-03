import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Semester } from './entities/semester.entity';

@Injectable()
export class SemestersService {
  constructor(
    @InjectRepository(Semester)
    private semestersRepository: Repository<Semester>,
  ) {}

  async findAll(organizationId: string): Promise<Semester[]> {
    return this.semestersRepository.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, organizationId?: string): Promise<Semester> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const semester = await this.semestersRepository.findOne({ where });
    if (!semester) {
      throw new NotFoundException(`Semester with ID ${id} not found`);
    }
    return semester;
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
}
