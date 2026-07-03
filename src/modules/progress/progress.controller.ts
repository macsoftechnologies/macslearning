import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompleteLessonDto } from './dto/progress.dto';

@Controller('progress')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post('lessons/:lessonId/complete')
  async completeLesson(
    @Request() req: any,
    @Param('lessonId') lessonId: string,
    @Body() body: CompleteLessonDto
  ) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(req.user.organizationId, req.user.userId, body.courseId);
    }
    return this.progressService.markLessonComplete(req.user.organizationId, req.user.userId, body.courseId, body.moduleId, lessonId);
  }

  @Get('courses/:courseId')
  async getCourseProgress(@Request() req: any, @Param('courseId') courseId: string) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(req.user.organizationId, req.user.userId, courseId);
    }
    return this.progressService.getCourseProgress(req.user.organizationId, req.user.userId, courseId);
  }

  @Get('courses/:courseId/students')
  @Roles('ORG_USER', 'FACULTY')
  async getAllStudentProgress(@Request() req: any, @Param('courseId') courseId: string) {
    return this.progressService.getAllStudentProgressForCourse(req.user.organizationId, courseId);
  }

  @Get('courses/:courseId/students/:studentId')
  @Roles('ORG_USER', 'FACULTY')
  async getStudentProgressDetail(@Request() req: any, @Param('courseId') courseId: string, @Param('studentId') studentId: string) {
    return this.progressService.getStudentProgressDetail(req.user.organizationId, courseId, studentId);
  }
}
