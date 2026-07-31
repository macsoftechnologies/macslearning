import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { ProgramsService } from './programs.service';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  async findAll() {
    const data = await this.programsService.findAll();
    return data.map(p => ({ ...p, status: p.isActive ? 'ACTIVE' : 'INACTIVE' }));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.programsService.findOne(id);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Post()
  async create(@Body() createData: any) {
    const data = await this.programsService.create(createData);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    const data = await this.programsService.update(id, updateData);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.programsService.remove(id);
    return { success: true, message: 'Program deleted successfully' };
  }
}
