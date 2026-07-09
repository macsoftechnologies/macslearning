import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateStudentDto, RejectStudentDto } from './dto/students.dto';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly enrollmentService: EnrollmentService,
    private readonly auditService: AuditService,
  ) {}

  @Get(':id/enrollments')
  @Roles('ORG_USER', 'FACULTY', 'STUDENT')
  async getStudentEnrollments(
    @Request() req: any,
    @Param('id') studentId: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      studentId = req.user.userId;
    }
    return this.enrollmentService.getStudentEnrollments(
      studentId,
      req.user.organizationId,
    );
  }

  @Get()
  @Roles('ORG_USER')
  async getAllStudents(
    @Request() req: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentsService.getAllStudents(req.user.organizationId, query);
  }

  @Get('pending')
  @Roles('ORG_USER')
  async getPendingStudents(
    @Request() req: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentsService.getPendingStudents(
      req.user.organizationId,
      query,
    );
  }

  @Get(':id')
  @Roles('ORG_USER')
  async getStudentById(@Request() req: any, @Param('id') studentId: string) {
    return this.studentsService.getStudentById(
      studentId,
      req.user.organizationId,
    );
  }

  @Patch(':id')
  @Roles('ORG_USER')
  async updateStudent(
    @Request() req: any,
    @Param('id') studentId: string,
    @Body() updateData: UpdateStudentDto,
  ) {
    return this.studentsService.updateStudent(
      studentId,
      req.user.organizationId,
      updateData,
    );
  }

  @Delete(':id')
  @Roles('ORG_USER')
  async deleteStudent(@Request() req: any, @Param('id') studentId: string) {
    return this.studentsService.deleteStudent(
      studentId,
      req.user.organizationId,
    );
  }

  @Patch(':id/approve')
  @Roles('ORG_USER')
  async approveStudent(@Request() req: any, @Param('id') studentId: string) {
    const result = await this.studentsService.approveStudent(
      studentId,
      req.user.userId,
      req.user.organizationId,
    );
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      action: 'Student Approved',
      targetId: result.student.id,
      metadata: { studentId: studentId },
    });
    return result;
  }

  @Patch(':id/reject')
  @Roles('ORG_USER')
  async rejectStudent(
    @Request() req: any,
    @Param('id') studentId: string,
    @Body() rejectDto: RejectStudentDto,
  ) {
    const result = await this.studentsService.rejectStudent(
      studentId,
      req.user.userId,
      rejectDto.rejectionReason,
      req.user.organizationId,
    );
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      action: 'Student Rejected',
      targetId: result.student.id,
      metadata: {
        studentEmail: result.student.email,
        reason: rejectDto.rejectionReason,
      },
    });
    return result;
  }
}
