import { Controller, Get, Post, Body, Param, Request } from '@nestjs/common';
import { ManualGradesService } from './manual-grades.service';

@Controller('manual-grades')
export class ManualGradesController {
  constructor(private readonly manualGradesService: ManualGradesService) {}

  @Get(':batchId/:courseId')
  async getGrades(@Request() req: any, @Param('batchId') batchId: string, @Param('courseId') courseId: string) {
    return this.manualGradesService.getGradesForCourse(req.user.organizationId, batchId, courseId);
  }

  @Post(':batchId/:courseId')
  async saveGrades(@Request() req: any, @Param('batchId') batchId: string, @Param('courseId') courseId: string, @Body('grades') grades: any[]) {
    const gradesData = grades.map(g => ({
      ...g,
      courseId,
      semesterId: batchId,
      organizationId: req.user.organizationId
    }));
    await this.manualGradesService.bulkUpsert(gradesData);
    return { success: true, message: 'Grades saved successfully' };
  }
}

