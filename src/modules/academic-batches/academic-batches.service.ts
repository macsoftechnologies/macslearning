import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicBatch } from '../transcripts/entities/academic-batch.entity';

@Injectable()
export class AcademicBatchesService {
  constructor(
    @InjectRepository(AcademicBatch)
    private readonly batchRepository: Repository<AcademicBatch>,
  ) {}

  async findAll(organizationId: string, programId?: string): Promise<AcademicBatch[]> {
    const where: any = { organizationId };
    if (programId) where.programId = programId;
    return this.batchRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, organizationId?: string): Promise<AcademicBatch> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const batch = await this.batchRepository.findOne({ where });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }
    return batch;
  }

  async create(createData: Partial<AcademicBatch>): Promise<AcademicBatch> {
    const batch = this.batchRepository.create(createData);
    return this.batchRepository.save(batch);
  }

  async update(id: string, organizationId: string, updateData: Partial<AcademicBatch>): Promise<AcademicBatch> {
    const batch = await this.findOne(id, organizationId);
    const updated = this.batchRepository.merge(batch, updateData);
    return this.batchRepository.save(updated);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const batch = await this.findOne(id, organizationId);
    await this.batchRepository.remove(batch);
  }
}
