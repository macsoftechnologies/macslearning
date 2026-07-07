import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOrganizationDto, UpdateOrganizationDto, UpdateOrganizationStatusDto } from './dto/organizations.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService
  ) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  @ApiOperation({ summary: 'Get all organizations with pagination and search' })
  async getOrganizations(@Request() req: any, @Query() query: PaginationQueryDto) {
    return this.organizationsService.getOrganizations(query);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async createOrganization(@Request() req: any, @Body() orgData: CreateOrganizationDto) {
    const org = await this.organizationsService.createOrganization(orgData);
    await this.auditService.createLog({
      actorId: req.user.userId,
      action: 'Organization Created',
      targetId: org._id,
      metadata: { name: org.name }
    });
    return org;
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async updateStatus(@Request() req: any, @Param('id') orgId: string, @Body() statusDto: UpdateOrganizationStatusDto) {
    const org = await this.organizationsService.updateStatus(orgId, statusDto.status);
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: orgId,
      action: `Organization ${statusDto.status}`,
      targetId: org._id,
      metadata: { name: org.name, status: statusDto.status }
    });
    return org;
  }

  @Get('me')
  @Roles('ORG_USER')
  async getMyOrganization(@Request() req: any) {
    return this.organizationsService.getOrganizationById(req.user.organizationId);
  }

  @Patch('me')
  @Roles('ORG_USER')
  async updateMyOrganization(@Request() req: any, @Body() updateData: UpdateOrganizationDto) {
    const org = await this.organizationsService.updateOrganization(req.user.organizationId, updateData);
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      action: 'Organization Updated',
      targetId: org._id,
      metadata: { name: org.name }
    });
    return org;
  }

  // --- Course Plans ---
  @Get('me/course-plans')
  @Roles('ORG_USER', 'FACULTY')
  async getMyCoursePlans(@Request() req: any) {
    return this.organizationsService.getCoursePlans(req.user.organizationId);
  }

  @Post('me/course-plans')
  @Roles('ORG_USER')
  async createMyCoursePlan(@Request() req: any, @Body() planData: any) {
    return this.organizationsService.createCoursePlan(req.user.organizationId, planData);
  }

  @Patch('me/course-plans/:planId')
  @Roles('ORG_USER')
  async updateMyCoursePlan(@Request() req: any, @Param('planId') planId: string, @Body() planData: any) {
    return this.organizationsService.updateCoursePlan(req.user.organizationId, planId, planData);
  }

  @Delete('me/course-plans/:planId')
  @Roles('ORG_USER')
  async deleteMyCoursePlan(@Request() req: any, @Param('planId') planId: string) {
    return this.organizationsService.deleteCoursePlan(req.user.organizationId, planId);
  }
}
