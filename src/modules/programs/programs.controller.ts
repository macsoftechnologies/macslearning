import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { ProgramsService } from './programs.service';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  async findAll() {
    return this.programsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.programsService.findOne(id);
  }

  @Post()
  async create(@Body() createData: any) {
    return this.programsService.create(createData);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.programsService.update(id, updateData);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.programsService.remove(id);
    return { success: true, message: 'Program deleted successfully' };
  }
}
