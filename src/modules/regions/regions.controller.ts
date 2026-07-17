import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { RegionsService } from './regions.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @Post()
  create(@Body() createRegionDto: CreateRegionDto, @Request() req: any) {
    const orgId = req.user.organizationId;
    const isSuperAdmin = req.user.userType === 'SUPER_ADMIN';
    return this.regionsService.create(createRegionDto, orgId, isSuperAdmin);
  }

  // Get all regions. Publicly accessible for registration dropdown.
  @Get()
  findAll(@Query('orgId') orgId?: string, @Query('slug') slug?: string, @Query('globalOnly') globalOnly?: boolean) {
    return this.regionsService.findAll(orgId, slug, globalOnly);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.regionsService.findOne(id, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateRegionDto: UpdateRegionDto,
  ) {
    return this.regionsService.update(id, req.user.organizationId, updateRegionDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.regionsService.remove(id, req.user.organizationId);
  }
}
