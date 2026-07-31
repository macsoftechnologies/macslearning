import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ManualGradesService } from './manual-grades.service';

@Controller('manual-grades')
export class ManualGradesController {
  constructor(private readonly manualGradesService: ManualGradesService) {}

  @Get(':batchId/:courseId')
  async getGrades(@Param('batchId') batchId: string, @Param('courseId') courseId: string) {
    // Mock response for dynamic UI
    return [
      { studentId: 'S001', student: { firstName: 'John', lastName: 'Doe', program: { name: 'M.Div.' } }, assignmentScore: 65, finalExamScore: 25 },
      { studentId: 'S002', student: { firstName: 'Jane', lastName: 'Smith', program: { name: 'M.Div.' } }, assignmentScore: 70, finalExamScore: 28 },
    ];
  }

  @Post(':batchId/:courseId')
  async saveGrades(@Param('batchId') batchId: string, @Param('courseId') courseId: string, @Body('grades') grades: any[]) {
    // Mock save logic
    return { success: true, message: 'Grades saved successfully' };
  }
}

