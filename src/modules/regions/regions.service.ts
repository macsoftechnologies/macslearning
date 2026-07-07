import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { Region, RegionDocument } from './schemas/region.schema';

@Injectable()
export class RegionsService {
  constructor(
    @InjectModel(Region.name) private regionModel: Model<RegionDocument>,
  ) {}

  async create(createRegionDto: CreateRegionDto, orgId: string): Promise<Region> {
    const createdRegion = new this.regionModel({
      ...createRegionDto,
      orgId,
    });
    return createdRegion.save();
  }

  async findAll(orgId?: string): Promise<Region[]> {
    const filter = orgId ? { orgId } : {};
    return this.regionModel.find(filter).exec();
  }

  async findOne(id: string): Promise<Region> {
    const region = await this.regionModel.findById(id).exec();
    if (!region) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }
    return region;
  }

  async update(id: string, updateRegionDto: UpdateRegionDto): Promise<Region> {
    const updatedRegion = await this.regionModel
      .findByIdAndUpdate(id, updateRegionDto, { new: true })
      .exec();
    
    if (!updatedRegion) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }
    return updatedRegion;
  }

  async remove(id: string): Promise<Region> {
    const deletedRegion = await this.regionModel.findByIdAndDelete(id).exec();
    if (!deletedRegion) {
      throw new NotFoundException(`Region with ID ${id} not found`);
    }
    return deletedRegion;
  }
}
