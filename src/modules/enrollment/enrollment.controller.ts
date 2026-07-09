import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  UseGuards,
  Request,
  Body,
  Query,
} from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminEnrollStudentDto } from './dto/enrollment.dto';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post('student/courses/:courseId/enroll')
  @Roles('STUDENT')
  async enrollInCourse(
    @Request() req: any,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentService.enrollStudent(
      req.user.userId,
      req.user.organizationId,
      courseId,
      req.user.regionId,
    );
  }

  @Post()
  @Roles('ORG_USER')
  async adminEnrollStudent(
    @Request() req: any,
    @Body() enrollmentData: AdminEnrollStudentDto,
  ) {
    // Requires Admin or ORG_USER privileges
    return this.enrollmentService.adminEnrollStudent(
      req.user.userId,
      req.user.organizationId,
      enrollmentData,
    );
  }

  @Get()
  @Roles('ORG_USER')
  async getEnrollments(
    @Request() req: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.enrollmentService.getEnrollments(
      req.user.organizationId,
      query,
    );
  }

  @Patch(':id/cancel')
  @Roles('ORG_USER')
  async cancelEnrollment(
    @Request() req: any,
    @Param('id') enrollmentId: string,
  ) {
    return this.enrollmentService.updateEnrollmentStatus(
      enrollmentId,
      req.user.organizationId,
      'CANCELLED',
    );
  }

  @Patch(':id/reactivate')
  @Roles('ORG_USER')
  async reactivateEnrollment(
    @Request() req: any,
    @Param('id') enrollmentId: string,
  ) {
    return this.enrollmentService.updateEnrollmentStatus(
      enrollmentId,
      req.user.organizationId,
      'ACTIVE',
    );
  }
}
