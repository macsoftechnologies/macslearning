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
  @ApiOperation({ summary: 'Generate a Vimeo upload ticket' })
  async getUploadTicket(
    @Request() req: any,
    @Body() body: { fileSize: number; videoName: string }
  ) {
    const orgId = req.user.organizationId;
    
    // Get or create a folder for this organization
    const folderUri = await this.vimeoService.getOrCreateOrganizationFolder(orgId);
    
    // Generate the upload ticket
    return this.vimeoService.createUploadTicket(body.fileSize, body.videoName, folderUri);
  }
}
