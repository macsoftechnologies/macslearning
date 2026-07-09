import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { Region } from './entities/region.entity';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region) private regionRepository: Repository<Region>,
  ) {}

  async create(
    createRegionDto: CreateRegionDto,
    orgId: string,
  ): Promise<Region> {
    const createdRegion = this.regionRepository.create({
      ...createRegionDto,
      orgId,
    });
    return this.regionRepository.save(createdRegion);
  }

  async findAll(orgId?: string): Promise<Region[]> {
    const filter = orgId ? { orgId } : {};
    return this.regionRepository.find({ where: filter });
  }

  async findOne(id: string): Promise<Region> {
    const region = await this.regionRepository.findOne({ where: { id } });
    if (!region) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }
    return region;
  }

  async update(id: string, updateRegionDto: UpdateRegionDto): Promise<Region> {
    await this.regionRepository.update(id, updateRegionDto);
    const updatedRegion = await this.regionRepository.findOne({
      where: { id },
    });

    if (!updatedRegion) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }
    return updatedRegion;
  }

  async remove(id: string): Promise<Region> {
    const region = await this.regionRepository.findOne({ where: { id } });
    if (!region) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }
    await this.regionRepository.delete(id);
    return region;
  }
}
