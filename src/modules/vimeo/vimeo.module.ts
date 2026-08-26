import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VimeoService } from './vimeo.service';
import { VimeoController } from './vimeo.controller';
import { Organization } from '../organizations/entities/org.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  providers: [VimeoService],
  controllers: [VimeoController],
  exports: [VimeoService]
})
export class VimeoModule {}
