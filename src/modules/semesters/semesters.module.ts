import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemestersController } from './semesters.controller';
import { SemestersService } from './semesters.service';
import { Semester } from './entities/semester.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Semester])],
  controllers: [SemestersController],
  providers: [SemestersService],
  exports: [SemestersService]
})
export class SemestersModule {}
