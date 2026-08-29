import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Program } from './entities/program.entity';
import { RegionConfig } from '../regions/entities/region-config.entity';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program)
    private programsRepository: Repository<Program>,
    @InjectRepository(RegionConfig)
    private regionConfigRepository: Repository<RegionConfig>,
  ) {}

  async findAll(organizationId: string, query: any = {}): Promise<any[]> {
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
    
    const programs = await this.programsRepository.find(findOptions);
    const regionConfigs = await this.regionConfigRepository.find({ where: { organizationId } });
    
    return programs.map(p => ({
      ...p,
      regionConfigs: regionConfigs.filter(rc => rc.programId === p.id)
    }));
  }

  async findOne(id: string, organizationId?: string): Promise<any> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const program = await this.programsRepository.findOne({ where });
    if (!program) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }
    const regionConfigWhere: any = { programId: id };
    if (organizationId) regionConfigWhere.organizationId = organizationId;
    else if (program.organizationId) regionConfigWhere.organizationId = program.organizationId;
    const regionConfigs = await this.regionConfigRepository.find({ where: regionConfigWhere });
    return { ...program, regionConfigs };
  }

  async create(createData: any): Promise<Program> {
    const { regionConfigs, ...programData } = createData;
    const program = this.programsRepository.create(programData as object);
    const savedProgram = await this.programsRepository.save(program) as Program;

    if (regionConfigs && Array.isArray(regionConfigs)) {
      for (const config of regionConfigs) {
        const rc = this.regionConfigRepository.create({
          ...config,
          programId: savedProgram.id,
          organizationId: savedProgram.organizationId,
        });
        await this.regionConfigRepository.save(rc);
      }
    }

    return savedProgram;
  }

  async update(id: string, organizationId: string, updateData: any): Promise<Program> {
    const { regionConfigs, ...programData } = updateData;
    const program = await this.findOne(id, organizationId);
    if (programData.isActive !== undefined) {
      program.isActive = programData.isActive;
    }
    const updated = this.programsRepository.merge(program, programData);
    const savedProgram = await this.programsRepository.save(updated);

    if (regionConfigs && Array.isArray(regionConfigs)) {
      // Delete existing configs for this program
      await this.regionConfigRepository.delete({ programId: id, organizationId });
      
      // Save new configs
      for (const config of regionConfigs) {
        const rc = this.regionConfigRepository.create({
          ...config,
          programId: savedProgram.id,
          organizationId: savedProgram.organizationId,
        });
        await this.regionConfigRepository.save(rc);
      }
    }

    return savedProgram;
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const program = await this.findOne(id, organizationId);
    await this.programsRepository.remove(program);
  }
}
