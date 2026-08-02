import { Controller, Get, Post, Body, Put, Param, Delete, Request, UseGuards, Query } from '@nestjs/common';
import { AcademicBatchesService } from './academic-batches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('academic-batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicBatchesController {
  constructor(private readonly batchesService: AcademicBatchesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  findAll(@Request() req: any, @Query('programId') programId?: string) {
    return this.batchesService.findAll(req.user.organizationId, programId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  findOne(@Param('id') id: string) {
    return this.batchesService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_USER')
  create(@Request() req: any, @Body() createData: any) {
    createData.organizationId = req.user.organizationId;
    return this.batchesService.create(createData);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.batchesService.update(id, updateData);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  remove(@Param('id') id: string) {
    return this.batchesService.remove(id);
  }
}
