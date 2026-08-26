import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DMinEvaluationsService } from './dmin-evaluations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('dmin-evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DMinEvaluationsController {
  constructor(private readonly dminService: DMinEvaluationsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findAll(@Request() req: any, @Query() query: any) {
    // If student, force filter to their own studentId
    const studentId = req.user.role === 'STUDENT' ? req.user.studentId || req.user.id : query.studentId;
    return this.dminService.findAll(req.user.organizationId, {
      studentId,
      programId: query.programId,
      status: query.status,
    });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.dminService.findOne(req.user.organizationId, id);
  }

  @Post()
  @Roles('STUDENT', 'ORG_USER', 'SUPER_ADMIN')
  async createSubmission(@Request() req: any, @Body() body: any) {
    const studentId = req.user.role === 'STUDENT' ? req.user.studentId || req.user.id : body.studentId;
    return this.dminService.createSubmission(req.user.organizationId, studentId, body);
  }

  @Put(':id/evaluate')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async evaluateSubmission(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const reviewerId = req.user.id || req.user.userId;
    return this.dminService.evaluateSubmission(req.user.organizationId, id, reviewerId, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.dminService.deleteSubmission(req.user.organizationId, id);
  }
}
