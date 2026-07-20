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
    isSuperAdmin: boolean = false
  ): Promise<Region> {
    const isGlobal = isSuperAdmin && createRegionDto.isGlobal;
    const createdRegion = this.regionRepository.create({
      ...createRegionDto,
      orgId: isGlobal ? 'GLOBAL' : orgId,
      isGlobal: !!isGlobal
    });
    return this.regionRepository.save(createdRegion);
  }

  async findAll(orgId?: string, slug?: string, globalOnly?: boolean, localOnly?: boolean): Promise<Region[]> {
    if (globalOnly) {
      return this.regionRepository.find({ where: { isGlobal: true } });
    }

    let targetOrgId = orgId;
    if (!targetOrgId && slug) {
      const org = await this.orgRepository.findOne({ where: { slug, isDeleted: false } });
      if (org) targetOrgId = org.id;
    }
    
    // Always include global regions when fetching for an org or if explicitly fetching global
    if (targetOrgId === 'GLOBAL') {
      return this.regionRepository.find({ where: { isGlobal: true } });
    }

    if (!targetOrgId) {
      return this.regionRepository.find({ where: { isGlobal: true } });
    }

    if (localOnly) {
      return this.regionRepository.find({ where: { orgId: targetOrgId } });
    }

    // Return both local regions and global regions
    return this.regionRepository.find({
      where: [
        { orgId: targetOrgId },
        { isGlobal: true }
      ]
    });
  }

  async findOne(id: string, orgId?: string): Promise<Region> {
    const where: any = [{ id, isGlobal: true }];
    if (orgId) {
      where.push({ id, orgId });
    }
    
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
