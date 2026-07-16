import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';

@ApiTags('Public Organizations')
@Controller('public/organizations')
export class PublicOrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Get public organization info by slug' })
  async getPublicOrganizationInfo(@Param('slug') slug: string) {
    return this.organizationsService.getOrganizationBySlugForPublic(slug);
  }
}
