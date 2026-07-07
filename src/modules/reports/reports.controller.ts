import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @Roles('ORG_USER', 'FINANCE')
  @ApiOperation({ summary: 'Get organization overview statistics' })
  async getOverviewStats(@Request() req: any) {
    return this.reportsService.getOverviewStats(req.user.organizationId);
  }

  @Get('super-admin/overview')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get super admin overview statistics' })
  async getSuperAdminOverviewStats() {
    return this.reportsService.getSuperAdminStats();
  }

  @Get('course-performance')
  @Roles('ORG_USER', 'FINANCE')
  @ApiOperation({ summary: 'Get course performance metrics' })
  async getCoursePerformance(@Request() req: any) {
    return this.reportsService.getCoursePerformance(req.user.organizationId);
  }

  @Get('student-activity')
  @Roles('ORG_USER', 'FINANCE')
  @ApiOperation({ summary: 'Get student activity metrics over time' })
  async getStudentActivity(@Request() req: any) {
    return this.reportsService.getStudentActivity(req.user.organizationId);
  }
}
