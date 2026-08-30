import { Controller, Get, Post, Body, Put, Param, Delete, Request, UseGuards, Query } from '@nestjs/common';
import { SemestersService } from './semesters.service';
import { SemestersRolloverService } from './semesters-rollover.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('semesters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SemestersController {
  constructor(
    private readonly semestersService: SemestersService,
    private readonly rolloverService: SemestersRolloverService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findAll(@Request() req: any) {
    const data = await this.semestersService.findAll(req.user.organizationId);
    return data.map(s => ({ ...s, status: s.isActive ? 'ACTIVE' : 'INACTIVE' }));
  }

  @Get(':id/summary')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async getSummary(@Request() req: any, @Param('id') id: string) {
    return this.rolloverService.getSemesterSummary(req.user.organizationId, id);
  }

  @Post(':id/rollover')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async executeRollover(@Request() req: any, @Param('id') id: string) {
    return this.rolloverService.executeSemesterRollover(req.user.organizationId, id);
  }

  @Get('student/:studentId/cyclic-status')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async getStudentCyclicStatus(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Query('programId') programId: string,
  ) {
    return this.rolloverService.getStudentCyclicStatus(
      req.user.organizationId,
      studentId,
      programId,
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findOne(@Request() req: any, @Param('id') id: string) {
    const data = await this.semestersService.findOne(id, req.user.organizationId);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async create(@Request() req: any, @Body() createData: any) {
    createData.organizationId = req.user.organizationId;
    const data = await this.semestersService.create(createData);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async createBulk(@Request() req: any, @Body() createDataArray: any[]) {
    if (!Array.isArray(createDataArray)) {
      throw new Error('Payload must be an array of semesters');
    }
    const withOrg = createDataArray.map(s => ({ ...s, organizationId: req.user.organizationId }));
    const data = await this.semestersService.createBulk(withOrg);
    return data.map(s => ({ ...s, status: s.isActive ? 'ACTIVE' : 'INACTIVE' }));
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async update(@Request() req: any, @Param('id') id: string, @Body() updateData: any) {
    const data = await this.semestersService.update(id, req.user.organizationId, updateData);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Post(':id/progress-students')
  @Roles('ORG_USER')
  async progressStudents(
    @Request() req: any,
    @Param('id') semesterId: string,
    @Body('batchId') batchId?: string,
  ) {
    return this.semestersService.progressCohortToNextSemester(
      req.user.organizationId,
      semesterId,
      batchId,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.semestersService.remove(id, req.user.organizationId);
    return { success: true, message: 'Semester deleted successfully' };
  }

  @Post(':id/courses/:courseId/link')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async linkCourse(
    @Request() req: any,
    @Param('id') semesterId: string,
    @Param('courseId') courseId: string,
    @Body() body: { programId: string }
  ) {
    return this.semestersService.linkCourse(
      req.user.organizationId,
      body.programId,
      semesterId,
      courseId
    );
  }

  @Delete(':id/courses/:courseId/link')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async unlinkCourse(
    @Request() req: any,
    @Param('id') semesterId: string,
    @Param('courseId') courseId: string,
    @Query('programId') programId: string
  ) {
    return this.semestersService.unlinkCourse(
      req.user.organizationId,
      programId,
      semesterId,
      courseId
    );
  }
}

