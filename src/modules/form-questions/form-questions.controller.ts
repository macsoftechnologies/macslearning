import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { FormQuestionsService } from './form-questions.service';
import { FormQuestion } from './entities/form-question.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('form-questions')
export class FormQuestionsController {
  constructor(private readonly formQuestionsService: FormQuestionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  create(@Req() req: any, @Body() data: Partial<FormQuestion>) {
    // Extract orgId from user or body depending on role.
    const orgId = req.user.userType === 'SUPER_ADMIN' ? (data.organizationId || req.user.organizationId) : req.user.organizationId;
    return this.formQuestionsService.create(orgId, data);
  }

  // Public/Private endpoint for fetching questions
  @Get()
  findAll(@Req() req: any) {
    // For admin users (authenticated), use their orgId.
    // For public registration, use the query param.
    const orgId = req.user?.organizationId || req.query.organizationId || '51756c28-e4e5-4145-88df-1afe12b7096b';
    return this.formQuestionsService.findAll(orgId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  update(@Req() req: any, @Param('id') id: string, @Body() data: Partial<FormQuestion>) {
    const orgId = req.user.userType === 'SUPER_ADMIN' ? (data.organizationId || req.user.organizationId) : req.user.organizationId;
    return this.formQuestionsService.update(id, orgId, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ORG_USER')
  remove(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user.organizationId;
    return this.formQuestionsService.remove(id, orgId);
  }
}
