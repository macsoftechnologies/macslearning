import { Controller, Get, Post, Body, Put, Param, Delete, Query, Request, UseGuards } from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findAll(@Request() req: any, @Query() query: any) {
    return this.programsService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.programsService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async create(@Request() req: any, @Body() createData: any) {
    createData.organizationId = req.user.organizationId;
    return this.programsService.create(createData);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async update(@Request() req: any, @Param('id') id: string, @Body() updateData: any) {
    return this.programsService.update(id, req.user.organizationId, updateData);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.programsService.remove(id, req.user.organizationId);
    return { success: true, message: 'Program deleted successfully' };
  }
}
