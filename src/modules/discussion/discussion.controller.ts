import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { DiscussionService } from './discussion.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateThreadDto } from './dto/discussion.dto';

@Controller('discussion')
@UseGuards(JwtAuthGuard)
export class DiscussionController {
  constructor(private readonly discussionService: DiscussionService) {}

  // 1. Get all inbox conversations (Direct 1:1 + Batch Groups + Subject Groups)
  @Get('inbox')
  async getInbox(@Request() req: any) {
    return this.discussionService.getInbox(
      req.user.organizationId,
      req.user.userId || req.user.id,
      req.user.userType,
    );
  }

  // 2. Get available contacts to start chat with (Admins, Faculty, Classmates)
  @Get('contacts')
  async getContacts(@Request() req: any) {
    return this.discussionService.getContacts(
      req.user.organizationId,
      req.user.userId || req.user.id,
      req.user.userType,
    );
  }

  // 3. Start or open 1:1 direct thread with student/faculty/admin
  @Post('direct-thread')
  async startDirectThread(
    @Request() req: any,
    @Body('recipientId') recipientId: string,
    @Body('initialMessage') initialMessage?: string,
  ) {
    return this.discussionService.startOrGetDirectThread(
      req.user.organizationId,
      req.user.userId || req.user.id,
      recipientId,
      initialMessage,
    );
  }

  // 4a. Open or ensure Course / Subject Group Thread
  @Post('course-thread')
  async openCourseThread(
    @Request() req: any,
    @Body('courseId') courseId: string,
    @Body('batchId') batchId?: string,
    @Body('title') title?: string,
  ) {
    return this.discussionService.getOrCreateCourseThread(
      req.user.organizationId,
      courseId,
      batchId,
      title,
    );
  }

  // 4b. Open or ensure Batch Group Thread
  @Post('batch-thread')
  async openBatchThread(
    @Request() req: any,
    @Body('batchId') batchId: string,
    @Body('title') title?: string,
  ) {
    return this.discussionService.getOrCreateBatchThread(
      req.user.organizationId,
      batchId,
      title,
    );
  }

  // 4c. Get members of a group thread
  @Get('threads/:threadId/members')
  async getThreadMembers(
    @Request() req: any,
    @Param('threadId') threadId: string,
  ) {
    return this.discussionService.getThreadMembers(
      req.user.organizationId,
      threadId,
    );
  }

  // 5. Get all messages of a thread
  @Get('threads/:threadId/messages')
  async getThreadMessages(
    @Request() req: any,
    @Param('threadId') threadId: string,
  ) {
    return this.discussionService.getThreadMessages(
      req.user.organizationId,
      threadId,
    );
  }

  // 6. Send message into a thread
  @Post('threads/:threadId/messages')
  async sendMessage(
    @Request() req: any,
    @Param('threadId') threadId: string,
    @Body('content') content: string,
  ) {
    return this.discussionService.addMessage(
      req.user.organizationId,
      threadId,
      req.user.userId || req.user.id,
      content,
    );
  }

  // Legacy Course Forum endpoints
  @Post('courses/:courseId/threads')
  async createThread(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Body() threadData: CreateThreadDto,
  ) {
    return this.discussionService.createThread(
      req.user.organizationId,
      courseId,
      req.user.userId || req.user.id,
      threadData,
    );
  }

  @Get('courses/:courseId/threads')
  async getThreads(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Query('lessonId') lessonId?: string,
  ) {
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
    return this.discussionService.addMessage(
      req.user.organizationId,
      threadId,
      req.user.userId || req.user.id,
      content,
    );
  }

  @Get('threads/:threadId/replies')
  async getReplies(
    @Request() req: any,
    @Param('threadId') threadId: string,
  ) {
    return this.discussionService.getReplies(
      req.user.organizationId,
      threadId,
    );
  }

  @Delete('threads/:threadId')
  async deleteThread(
    @Request() req: any,
    @Param('threadId') threadId: string,
  ) {
    return this.discussionService.deleteThread(
      req.user.organizationId,
      threadId,
    );
  }

  @Delete('replies/:replyId')
  async deleteReply(
    @Request() req: any,
    @Param('replyId') replyId: string,
  ) {
    return this.discussionService.deleteReply(
      req.user.organizationId,
      replyId,
    );
  }

  @Patch('replies/:replyId/accept')
  async markAccepted(
    @Request() req: any,
    @Param('replyId') replyId: string,
  ) {
    return this.discussionService.markAccepted(
      req.user.organizationId,
      replyId,
    );
  }
}
