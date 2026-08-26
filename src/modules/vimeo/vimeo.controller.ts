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
  @Roles('ORG_USER', 'FACULTY')
  @ApiOperation({ summary: 'Generate a Vimeo TUS upload ticket' })
  async generateTicket(
    @Request() req: any,
    @Body() body: { fileSize: number; videoName: string }
  ) {
    const orgId = req.user?.organizationId;
    const ticket = await this.vimeoService.generateUploadTicket(body.fileSize, body.videoName, orgId);
    return ticket;
  }

  @Get('transcript')
  @Roles('ORG_USER', 'FACULTY', 'SUPER_ADMIN', 'STUDENT')
  @ApiOperation({ summary: 'Fetch auto-generated captions/transcript from Vimeo for a video' })
  async getTranscriptGet(
    @Request() req: any,
    @Query('videoUrl') videoUrl?: string,
    @Query('videoId') videoId?: string
  ) {
    const target = videoUrl || videoId || '';
    const orgId = req.user?.organizationId;
    return this.vimeoService.getVideoTranscript(target, orgId);
  }

  @Post('transcript')
  @Roles('ORG_USER', 'FACULTY', 'SUPER_ADMIN', 'STUDENT')
  @ApiOperation({ summary: 'Fetch auto-generated captions/transcript from Vimeo for a video (POST)' })
  async getTranscriptPost(
    @Request() req: any,
    @Body() body: { videoUrl?: string; videoId?: string }
  ) {
    const target = body.videoUrl || body.videoId || '';
    const orgId = req.user?.organizationId;
    return this.vimeoService.getVideoTranscript(target, orgId);
  }
}