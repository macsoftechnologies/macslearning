import { Controller, Get, Post, Body, Put, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { SemestersService } from './semesters.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('semesters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findAll(@Request() req: any) {
    const data = await this.semestersService.findAll(req.user.organizationId);
    return data.map(s => ({ ...s, status: s.isActive ? 'ACTIVE' : 'INACTIVE' }));
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findOne(@Request() req: any, @Param('id') id: string) {
    const data = await this.semestersService.findOne(id, req.user.organizationId);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async create(@Request() req: any, @Body() createData: any) {
    createData.organizationId = req.user.organizationId;
    const data = await this.semestersService.create(createData);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async createBulk(@Request() req: any, @Body() createDataArray: any[]) {
    if (!Array.isArray(createDataArray)) {
      throw new Error('Payload must be an array of semesters');
    }
    const withOrg = createDataArray.map(s => ({ ...s, organizationId: req.user.organizationId }));
    const data = await this.semestersService.createBulk(withOrg);
    return data.map(s => ({ ...s, status: s.isActive ? 'ACTIVE' : 'INACTIVE' }));
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async update(@Request() req: any, @Param('id') id: string, @Body() updateData: any) {
    const data = await this.semestersService.update(id, req.user.organizationId, updateData);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.semestersService.remove(id, req.user.organizationId);
    return { success: true, message: 'Semester deleted successfully' };
  }
}
