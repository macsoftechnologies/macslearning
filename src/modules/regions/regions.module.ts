import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegionsService } from './regions.service';
import { RegionsController } from './regions.controller';
import { Region } from './entities/region.entity';

import { Organization } from '../organizations/entities/org.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Region, Organization])],
  controllers: [RegionsController],
  providers: [RegionsService],
  exports: [RegionsService],
})
export class RegionsModule {}
