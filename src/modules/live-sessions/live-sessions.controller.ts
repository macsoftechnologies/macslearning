import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { LiveSessionsService } from './live-sessions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('live-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LiveSessionsController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async findAll(
    @Request() req: any,
    @Query('batchId') batchId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.liveSessionsService.findAll(req.user.organizationId, batchId, courseId);
  }

  @Get('batch/:batchId/roster')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async getBatchRoster(@Request() req: any, @Param('batchId') batchId: string) {
    return this.liveSessionsService.getBatchRoster(req.user.organizationId, batchId);
  }

  @Get('student/upcoming')
  @Roles('STUDENT', 'ORG_USER', 'SUPER_ADMIN')
  async getUpcomingForStudent(@Request() req: any) {
    const studentId = req.user.id || req.user.sub;
    return this.liveSessionsService.getUpcomingForStudent(req.user.organizationId, studentId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async create(@Request() req: any, @Body() body: any) {
    return this.liveSessionsService.create(req.user.organizationId, body);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.liveSessionsService.update(req.user.organizationId, id, body);
  }

  @Put(':id/attendance')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async markAttendance(
    @Request() req: any,
    @Param('id') id: string,
    @Body('attendeeStudentIds') attendeeStudentIds: string[],
  ) {
    return this.liveSessionsService.markAttendance(req.user.organizationId, id, attendeeStudentIds);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.liveSessionsService.remove(req.user.organizationId, id);
  }
}
