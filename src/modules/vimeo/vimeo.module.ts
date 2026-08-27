import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VimeoService } from './vimeo.service';
import { VimeoController } from './vimeo.controller';
import { Organization } from '../organizations/entities/org.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseModule } from '../content/entities/courseModule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Lesson,
      Course,
      CourseModule,
    ]),
  ],
  providers: [VimeoService],
  controllers: [VimeoController],
  exports: [VimeoService],
})
export class VimeoModule {}
