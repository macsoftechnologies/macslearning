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

  async findAll(): Promise<Semester[]> {
    return this.semestersRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Semester> {
    const semester = await this.semestersRepository.findOne({ where: { id } });
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

  async update(id: string, updateData: any): Promise<Semester> {
    const semester = await this.findOne(id);
    if (updateData.status === 'ACTIVE' || updateData.status === 'INACTIVE') {
      semester.isActive = updateData.status === 'ACTIVE';
    }
    if (updateData.name) {
        updateData.term = updateData.name;
    }
    const updated = this.semestersRepository.merge(semester, updateData);
    return this.semestersRepository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const semester = await this.findOne(id);
    await this.semestersRepository.remove(semester);
  }
}
