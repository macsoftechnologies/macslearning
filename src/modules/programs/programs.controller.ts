import { Controller, Get, Post, Body, Put, Param, Delete, Query, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization } from '../organizations/entities/org.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly programsService: ProgramsService,
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findAll(@Request() req: any, @Query() query: any) {
    return this.programsService.findAll(req.user.organizationId, query);
  }

  @Get('public')
  async findAllPublic(@Query() query: any) {
    let orgId = query.organizationId;
    if (!orgId && query.slug) {
      const org = await this.orgRepository.findOne({ where: { slug: query.slug } });
      if (org) orgId = org.id;
    }
    if (!orgId) {
      throw new BadRequestException('organizationId or valid organization slug is required');
    }
    return this.programsService.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.programsService.findOne(id, req.user.organizationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async create(@Request() req: any, @Body() createData: any) {
    createData.organizationId = req.user.organizationId;
    return this.programsService.create(createData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async update(@Request() req: any, @Param('id') id: string, @Body() updateData: any) {
    return this.programsService.update(id, req.user.organizationId, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.programsService.remove(id, req.user.organizationId);
    return { success: true, message: 'Program deleted successfully' };
  }
}
