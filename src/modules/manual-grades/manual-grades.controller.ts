import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ManualGradesService } from './manual-grades.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { RolesGuard } from '../auth/roles.guard';

@Controller('manual-grades')
export class ManualGradesController {
  constructor(private readonly manualGradesService: ManualGradesService) {}

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('SUPER_ADMIN', 'FACULTY')
  @Post('bulk')
  async bulkUpsert(@Body() gradesData: any[]) {
    return this.manualGradesService.bulkUpsert(gradesData);
  }
}
