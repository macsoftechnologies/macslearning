import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Program } from './entities/program.entity';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program)
    private programsRepository: Repository<Program>,
  ) {}

  async findAll(organizationId: string, query: any = {}): Promise<Program[]> {
    const where: any = { organizationId };
    if (query.status) {
      where.status = query.status;
    }
    
    let findOptions: any = { where, order: { createdAt: 'DESC' } };
    
    if (query.search) {
      findOptions.where = [
        { ...where, name: Like(`%${query.search}%`) },
        { ...where, description: Like(`%${query.search}%`) }
      ];
    }
    
    return this.programsRepository.find(findOptions);
  }

  async findOne(id: string, organizationId?: string): Promise<Program> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const program = await this.programsRepository.findOne({ where });
    if (!program) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }
    return program;
  }

  async create(createData: Partial<Program>): Promise<Program> {
    const program = this.programsRepository.create(createData);
    return this.programsRepository.save(program);
  }

  async update(id: string, organizationId: string, updateData: any): Promise<Program> {
    const program = await this.findOne(id, organizationId);
    if (updateData.isActive !== undefined) {
      program.isActive = updateData.isActive;
    }
    const updated = this.programsRepository.merge(program, updateData);
    return this.programsRepository.save(updated);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const program = await this.findOne(id, organizationId);
    await this.programsRepository.remove(program);
  }
}
