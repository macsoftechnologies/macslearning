import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ContentService } from './content.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { CreateLessonCheckpointDto, AnswerCheckpointDto } from './dto/lesson-checkpoint.dto';

@Controller('courses/:courseId/lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonCheckpointController {
  constructor(
    private readonly contentService: ContentService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post(':lessonId/checkpoints')
  @Roles('ORG_USER', 'FACULTY')
  async createCheckpoint(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateLessonCheckpointDto,
  ) {
    return this.contentService.createLessonCheckpoint(req.user.organizationId, courseId, lessonId, dto);
  }

  @Get(':lessonId/checkpoints')
  async getCheckpoints(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(req.user.organizationId, req.user.userId, courseId);
    }
    return this.contentService.getLessonCheckpoints(req.user.organizationId, courseId, lessonId);
  }

  @Post(':lessonId/checkpoints/:checkpointId/answer')
  async answerCheckpoint(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Param('checkpointId') checkpointId: string,
    @Body() dto: AnswerCheckpointDto,
  ) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(req.user.organizationId, req.user.userId, courseId);
    }
    return this.contentService.answerLessonCheckpoint(req.user.organizationId, req.user.userId, courseId, lessonId, checkpointId, dto);
  }

  @Get(':lessonId/checkpoints/:checkpointId/ungraded')
  @Roles('ORG_USER', 'FACULTY')
  async getUngraded(@Request() req: any, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string, @Param('checkpointId') checkpointId: string) {
    return this.contentService.getUngradedCheckpointAnswers(req.user.organizationId, checkpointId);
  }

  @Patch(':lessonId/checkpoints/answers/:answerId/grade')
  @Roles('ORG_USER', 'FACULTY')
  async gradeAnswer(@Request() req: any, @Param('answerId') answerId: string, @Body() body: { marks: number }) {
    return this.contentService.gradeCheckpointAnswer(req.user.organizationId, req.user.userId, answerId, body.marks);
  }
}
