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
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findAll(
    @Request() req: any,
    @Query('batchId') batchId?: string,
    @Query('courseId') courseId?: string,
  ) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    return this.liveSessionsService.findAll(orgId, batchId, courseId);
  }

  @Get('batch/:batchId/roster')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async getBatchRoster(
    @Request() req: any,
    @Param('batchId') batchId: string,
    @Query('courseId') courseId?: string,
  ) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    return this.liveSessionsService.getBatchRoster(orgId, batchId, courseId);
  }

  @Get('student/upcoming')
  @Roles('STUDENT', 'ORG_USER', 'SUPER_ADMIN')
  async getUpcomingForStudent(@Request() req: any) {
    const studentId = req.user?.id || req.user?.userId || req.user?.sub;
    const orgId = req.user?.organizationId || req.user?.orgId;
    return this.liveSessionsService.getUpcomingForStudent(orgId, studentId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async create(@Request() req: any, @Body() body: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    return this.liveSessionsService.create(orgId, body);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    return this.liveSessionsService.update(orgId, id, body);
  }

  @Put(':id/attendance')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async markAttendance(
    @Request() req: any,
    @Param('id') id: string,
    @Body('attendeeStudentIds') attendeeStudentIds: string[],
  ) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    return this.liveSessionsService.markAttendance(orgId, id, attendeeStudentIds);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async remove(@Request() req: any, @Param('id') id: string) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    return this.liveSessionsService.remove(orgId, id);
  }
}
