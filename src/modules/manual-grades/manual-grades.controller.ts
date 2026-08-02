import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ManualGradesService } from './manual-grades.service';

@Controller('manual-grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManualGradesController {
  constructor(private readonly manualGradesService: ManualGradesService) {}

  @Get(':batchId/:semesterId/:courseId')
  @Roles('ORG_USER', 'FACULTY')
  async getGrades(@Request() req: any, @Param('batchId') batchId: string, @Param('semesterId') semesterId: string, @Param('courseId') courseId: string) {
    return this.manualGradesService.getGradesForCourse(req.user.organizationId, batchId, semesterId, courseId);
  }

  @Post(':batchId/:semesterId/:courseId')
  @Roles('ORG_USER', 'FACULTY')
  async saveGrades(@Request() req: any, @Param('batchId') batchId: string, @Param('semesterId') semesterId: string, @Param('courseId') courseId: string, @Body('grades') grades: any[]) {
    const gradesData = grades.map(g => ({
      ...g,
      courseId,
      semesterId,
      academicBatchId: batchId, // Ensure offline grade saves the batch
      organizationId: req.user.organizationId
    }));
    await this.manualGradesService.bulkUpsert(gradesData);
    return { success: true, message: 'Grades saved successfully' };
  }
}

