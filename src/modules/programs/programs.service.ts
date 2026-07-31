import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program } from './entities/program.entity';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program)
    private programsRepository: Repository<Program>,
  ) {}

  async findAll(): Promise<Program[]> {
    return this.programsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Program> {
    const program = await this.programsRepository.findOne({ where: { id } });
    if (!program) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }
    return program;
  }

  async create(createData: Partial<Program>): Promise<Program> {
    const program = this.programsRepository.create(createData);
    return this.programsRepository.save(program);
  }

  async update(id: string, updateData: any): Promise<Program> {
    const program = await this.findOne(id);
    if (updateData.status === 'ACTIVE' || updateData.status === 'INACTIVE') {
      program.isActive = updateData.status === 'ACTIVE';
    }
    const updated = this.programsRepository.merge(program, updateData);
    return this.programsRepository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const program = await this.findOne(id);
    await this.programsRepository.remove(program);
  }
}
