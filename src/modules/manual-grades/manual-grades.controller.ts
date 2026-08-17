import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ManualGradesService } from './manual-grades.service';

@Controller('manual-grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManualGradesController {
  constructor(private readonly manualGradesService: ManualGradesService) {}

  @Get(':batchId/:courseId')
  @Roles('ORG_USER', 'FACULTY')
  async getGradesDirect(@Request() req: any, @Param('batchId') batchId: string, @Param('courseId') courseId: string) {
    return this.manualGradesService.getGradesForCourse(req.user.organizationId, batchId, null, courseId);
  }

  @Get(':batchId/:semesterId/:courseId')
  @Roles('ORG_USER', 'FACULTY')
  async getGrades(@Request() req: any, @Param('batchId') batchId: string, @Param('semesterId') semesterId: string, @Param('courseId') courseId: string) {
    const sem = (semesterId === 'all' || semesterId === 'none' || semesterId === 'undefined') ? null : semesterId;
    return this.manualGradesService.getGradesForCourse(req.user.organizationId, batchId, sem, courseId);
  }

  @Post(':batchId/:courseId')
  @Roles('ORG_USER', 'FACULTY')
  async saveGradesDirect(
    @Request() req: any, 
    @Param('batchId') batchId: string, 
    @Param('courseId') courseId: string, 
    @Body() body: any
  ) {
    const rawGrades = Array.isArray(body) ? body : (Array.isArray(body?.grades) ? body.grades : []);
    const gradesData = rawGrades.map((g: any) => ({
      ...g,
      courseId,
      academicBatchId: batchId,
      organizationId: req.user.organizationId
    }));
    await this.manualGradesService.bulkUpsert(gradesData);
    return { success: true, message: 'Grades saved successfully' };
  }

  @Post(':batchId/:semesterId/:courseId')
  @Roles('ORG_USER', 'FACULTY')
  async saveGrades(
    @Request() req: any, 
    @Param('batchId') batchId: string, 
    @Param('semesterId') semesterId: string, 
    @Param('courseId') courseId: string, 
    @Body() body: any
  ) {
    const rawGrades = Array.isArray(body) ? body : (Array.isArray(body?.grades) ? body.grades : []);
    const sem = (semesterId === 'all' || semesterId === 'none' || semesterId === 'undefined') ? null : semesterId;
    const gradesData = rawGrades.map((g: any) => ({
      ...g,
      courseId,
      semesterId: sem,
      academicBatchId: batchId,
      organizationId: req.user.organizationId
    }));
    await this.manualGradesService.bulkUpsert(gradesData);
    return { success: true, message: 'Grades saved successfully' };
  }
}

