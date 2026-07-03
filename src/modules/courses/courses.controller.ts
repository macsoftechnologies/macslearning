import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCourseDto, UpdateCourseDto } from './dto/courses.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@ApiTags('Courses')
@ApiBearerAuth()
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly enrollmentService: EnrollmentService,
    private readonly auditService: AuditService
  ) {}

  @Get(':id/students')
  @Roles('ORG_USER', 'FACULTY')
  async getCourseStudents(@Request() req: any, @Param('id') courseId: string) {
    return this.enrollmentService.getCourseStudents(courseId, req.user.organizationId);
  }

  @Post()
  @Roles('ORG_USER', 'FACULTY')
  async createCourse(@Request() req: any, @Body() courseData: CreateCourseDto) {
    // Requires FACULTY or ORG_USER role
    const course = await this.coursesService.createCourse(req.user.organizationId, req.user.userId, courseData);
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      action: 'Course Created',
      targetId: course._id,
      metadata: { courseTitle: course.title }
    });
    return course;
  }

  @Get()
  @ApiOperation({ summary: 'Get all courses with pagination and search' })
  async getCourses(@Request() req: any, @Query() query: PaginationQueryDto, @Query('status') status?: string) {
    return this.coursesService.getCourses(req.user.organizationId, query, status, req.user.userType);
  }

  @Get(':id')
  async getCourseById(@Request() req: any, @Param('id') courseId: string) {
    return this.coursesService.getCourseById(courseId, req.user.organizationId, req.user.userType);
  }

  @Patch(':id')
  @Roles('ORG_USER', 'FACULTY')
  async updateCourse(@Request() req: any, @Param('id') courseId: string, @Body() updateData: UpdateCourseDto) {
    return this.coursesService.updateCourse(courseId, req.user.organizationId, updateData);
  }

  @Patch(':id/status')
  @Roles('ORG_USER', 'FACULTY')
  async updateCourseStatus(@Request() req: any, @Param('id') courseId: string, @Body() updateData: UpdateCourseDto) {
    const course = await this.coursesService.updateCourse(courseId, req.user.organizationId, updateData);
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      action: `Course Status Updated`,
      targetId: course._id,
      metadata: { courseTitle: course.title, status: updateData.status }
    });
    return course;
  }

  @Delete(':id')
  @Roles('ORG_USER', 'FACULTY')
  async deleteCourse(@Request() req: any, @Param('id') courseId: string) {
    return this.coursesService.deleteCourse(courseId, req.user.organizationId);
  }
}
