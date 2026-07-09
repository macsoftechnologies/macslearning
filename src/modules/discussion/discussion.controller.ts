import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { DiscussionService } from './discussion.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateThreadDto } from './dto/discussion.dto';

@Controller('discussion')
@UseGuards(JwtAuthGuard)
export class DiscussionController {
  constructor(
    private readonly discussionService: DiscussionService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post('courses/:courseId/threads')
  async createThread(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Body() threadData: CreateThreadDto,
  ) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        courseId,
      );
    }
    return this.discussionService.createThread(
      req.user.organizationId,
      courseId,
      req.user.userId,
      threadData,
    );
  }

  @Get('courses/:courseId/threads')
  async getThreads(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Query('lessonId') lessonId?: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        courseId,
      );
    }
    return this.discussionService.getThreads(
      req.user.organizationId,
      courseId,
      lessonId,
    );
  }

  @Get('courses/:courseId/threads/:threadId')
  async getThreadById(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Param('threadId') threadId: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        courseId,
      );
    }
    return this.discussionService.getThreadById(
      req.user.organizationId,
      courseId,
      threadId,
    );
  }

  @Post('threads/:threadId/replies')
  async addReply(
    @Request() req: any,
    @Param('threadId') threadId: string,
    @Body('content') content: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      const thread = await this.discussionService.findThreadById(
        req.user.organizationId,
        undefined,
        threadId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        thread.courseId.toString(),
      );
    }
    return this.discussionService.addReply(
      req.user.organizationId,
      threadId,
      req.user.userId,
      content,
    );
  }

  @Get('threads/:threadId/replies')
  async getReplies(@Request() req: any, @Param('threadId') threadId: string) {
    if (req.user.userType === 'STUDENT') {
      const thread = await this.discussionService.findThreadById(
        req.user.organizationId,
        undefined,
        threadId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        thread.courseId.toString(),
      );
    }
    return this.discussionService.getReplies(req.user.organizationId, threadId);
  }

  @Patch('threads/:threadId/replies/:replyId/accept')
  async acceptReply(
    @Request() req: any,
    @Param('threadId') threadId: string,
    @Param('replyId') replyId: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      const thread = await this.discussionService.findThreadById(
        req.user.organizationId,
        undefined,
        threadId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        thread.courseId.toString(),
      );
    }
    return this.discussionService.markReplyAsAccepted(
      req.user.organizationId,
      threadId,
      replyId,
      req.user.userId,
      req.user.userType,
    );
  }
}
