import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { SemestersService } from './semesters.service';

@Controller('semesters')
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Get()
  async findAll() {
    const data = await this.semestersService.findAll();
    return data.map(s => ({ ...s, status: s.isActive ? 'ACTIVE' : 'INACTIVE' }));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.semestersService.findOne(id);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Post()
  async create(@Body() createData: any) {
    const data = await this.semestersService.create(createData);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Post('bulk')
  async createBulk(@Body() createDataArray: any[]) {
    if (!Array.isArray(createDataArray)) {
      throw new Error('Payload must be an array of semesters');
    }
    const data = await this.semestersService.createBulk(createDataArray);
    return data.map(s => ({ ...s, status: s.isActive ? 'ACTIVE' : 'INACTIVE' }));
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    const data = await this.semestersService.update(id, updateData);
    return { ...data, status: data.isActive ? 'ACTIVE' : 'INACTIVE' };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.semestersService.remove(id);
    return { success: true, message: 'Semester deleted successfully' };
  }
}
