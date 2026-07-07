import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FacultyService } from './faculty.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Faculty')
@ApiBearerAuth()
@Controller('faculty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FacultyController {
  constructor(private readonly facultyService: FacultyService) {}

  @Get('dashboard-stats')
  @Roles('FACULTY')
  async getDashboardStats(@Request() req: any) {
    return this.facultyService.getDashboardStats(req.user.organizationId, req.user.userId);
  }

  @Get('grading-queue')
  @Roles('FACULTY')
  async getGradingQueue(@Request() req: any) {
    return this.facultyService.getGradingQueue(req.user.organizationId, req.user.userId);
  }
}
