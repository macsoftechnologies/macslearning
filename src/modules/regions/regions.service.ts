import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { Region } from './entities/region.entity';
import { Organization } from '../organizations/entities/org.entity';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region) private regionRepository: Repository<Region>,
    @InjectRepository(Organization) private orgRepository: Repository<Organization>,
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

  async findAll(orgId?: string, slug?: string): Promise<Region[]> {
    let targetOrgId = orgId;
    if (!targetOrgId && slug) {
      const org = await this.orgRepository.findOne({ where: { slug, isDeleted: false } });
      if (org) targetOrgId = org.id;
    }
    if (!targetOrgId) {
      return [];
    }
    const filter = { orgId: targetOrgId };
    return this.regionRepository.find({ where: filter });
  }

  async findOne(id: string, orgId?: string): Promise<Region> {
    const where: any = { id };
    if (orgId) where.orgId = orgId;
    const region = await this.regionRepository.findOne({ where });
    if (!region) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }
    return region;
  }

  async update(id: string, orgId: string | undefined, updateRegionDto: UpdateRegionDto): Promise<Region> {
    const region = await this.findOne(id, orgId);
    await this.regionRepository.update(id, updateRegionDto);
    return this.findOne(id, orgId);
  }

  async remove(id: string, orgId?: string): Promise<Region> {
    const region = await this.findOne(id, orgId);
    await this.regionRepository.delete(id);
    return region;
  }
}
