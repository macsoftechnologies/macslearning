import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
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
    const orgName = req.user.organizationId; // Using org ID as folder name
    const ticket = await this.vimeoService.generateUploadTicket(body.fileSize, body.videoName, orgName);
    return { data: ticket };
  }
}