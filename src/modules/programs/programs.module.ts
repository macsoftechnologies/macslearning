import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { Program } from './entities/program.entity';
import { RegionConfig } from '../regions/entities/region-config.entity';
import { Organization } from '../organizations/entities/org.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Program, RegionConfig, Organization])],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService]
})
export class ProgramsModule {}
