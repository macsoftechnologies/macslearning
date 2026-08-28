import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VimeoService } from './vimeo.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Vimeo')
@ApiBearerAuth()
@Controller('vimeo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VimeoController {
  constructor(private readonly vimeoService: VimeoService) {}

  @Post('upload-ticket')
  @Roles('ORG_USER', 'FACULTY', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Generate a Vimeo TUS upload ticket' })
  async generateTicket(
    @Request() req: any,
    @Body() body: { fileSize: number; videoName: string }
  ) {
    const orgId = req.user?.organizationId || req.user?.orgId || req.user?.organization;
    const ticket = await this.vimeoService.generateUploadTicket(body.fileSize, body.videoName, orgId);
    return ticket;
  }

  @Get('course-transcripts')
  @Roles('ORG_USER', 'FACULTY', 'SUPER_ADMIN', 'STUDENT')
  @ApiOperation({ summary: 'Fetch all lesson transcripts for an entire course in a single call' })
  async getCourseTranscripts(
    @Request() req: any,
    @Query('courseId') courseId: string
  ) {
    const orgId = req.user?.organizationId;
    return this.vimeoService.getCourseTranscripts(courseId, orgId);
  }

  @Get('transcript')
  @Roles('ORG_USER', 'FACULTY', 'SUPER_ADMIN', 'STUDENT')
  @ApiOperation({ summary: 'Fetch auto-generated captions/transcript from Vimeo for a video or lessonId' })
  async getTranscriptGet(
    @Request() req: any,
    @Query('videoUrl') videoUrl?: string,
    @Query('videoId') videoId?: string,
    @Query('lessonId') lessonId?: string
  ) {
    const target = lessonId || videoUrl || videoId || '';
    const orgId = req.user?.organizationId;
    return this.vimeoService.getVideoTranscript(target, orgId);
  }

  @Post('transcript')
  @Roles('ORG_USER', 'FACULTY', 'SUPER_ADMIN', 'STUDENT')
  @ApiOperation({ summary: 'Fetch auto-generated captions/transcript from Vimeo for a video (POST)' })
  async getTranscriptPost(
    @Request() req: any,
    @Body() body: { videoUrl?: string; videoId?: string; lessonId?: string }
  ) {
    const target = body.lessonId || body.videoUrl || body.videoId || '';
    const orgId = req.user?.organizationId;
    return this.vimeoService.getVideoTranscript(target, orgId);
  }
}
