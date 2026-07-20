import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ResultsService } from './results.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('results')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('student')
  async getMyResults(@Request() req: any) {
    return this.resultsService.getMyResults(
      req.user.organizationId,
      req.user.userId,
    );
  }

  @Get('student/attempts')
  async getMyAttempts(@Request() req: any) {
    return this.resultsService.getMyAttempts(
      req.user.organizationId,
      req.user.userId,
    );
  }

  @Get('student/video-quizzes')
  async getMyVideoQuizAnswers(@Request() req: any) {
    return this.resultsService.getMyVideoQuizAnswers(
      req.user.organizationId,
      req.user.userId,
    );
  }

  @Get('courses/:courseId')
  @Roles('ORG_USER', 'FACULTY')
  async getCourseResults(
    @Request() req: any,
    @Param('courseId') courseId: string,
  ) {
    return this.resultsService.getCourseResults(
      req.user.organizationId,
      courseId,
    );
  }
}
