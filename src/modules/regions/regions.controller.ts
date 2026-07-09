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
    // Assuming req.user contains the user info including organizationId
    const orgId = req.user.organizationId;
    return this.regionsService.create(createRegionDto, orgId);
  }

  // Get all regions. Publicly accessible for registration dropdown.
  @Get()
  findAll(@Query('orgId') orgId?: string) {
    return this.regionsService.findAll(orgId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.regionsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRegionDto: UpdateRegionDto) {
    return this.regionsService.update(id, updateRegionDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.regionsService.remove(id);
  }
}
