import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdateOrganizationStatusDto,
} from './dto/organizations.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  @ApiOperation({ summary: 'Get all organizations with pagination and search' })
  async getOrganizations(
    @Request() req: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.organizationsService.getOrganizations(query);
  }

  @Get('counts')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  @ApiOperation({ summary: 'Get counts for pending and expiring organizations' })
  async getCounts() {
    return this.organizationsService.getCounts();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async createOrganization(
    @Request() req: any,
    @Body() orgData: CreateOrganizationDto,
  ) {
    const org = await this.organizationsService.createOrganization(orgData);
    await this.auditService.createLog({
      actorId: req.user.userId,
      action: 'Organization Created',
      targetId: org.id,
      metadata: { name: org.name },
    });
    return org;
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async updateStatus(
    @Request() req: any,
    @Param('id') orgId: string,
    @Body() statusDto: UpdateOrganizationStatusDto,
  ) {
    const org = await this.organizationsService.updateStatus(
      orgId,
      statusDto.status,
    );
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: orgId,
      action: `Organization ${statusDto.status}`,
      targetId: org.id,
      metadata: { name: org.name, status: statusDto.status },
    });
    return org;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async updateOrganizationById(
    @Request() req: any,
    @Param('id') orgId: string,
    @Body() updateData: UpdateOrganizationDto,
  ) {
    const org = await this.organizationsService.updateOrganization(
      orgId,
      updateData,
    );
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: orgId,
      action: 'Organization Updated',
      targetId: org.id,
      metadata: { name: org.name },
    });
    return org;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async deleteOrganization(@Request() req: any, @Param('id') orgId: string) {
    const result = await this.organizationsService.deleteOrganization(orgId);
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: orgId,
      action: 'Organization Deleted/Rejected',
      targetId: orgId,
      metadata: {},
    });
    return result;
  }

  @Post(':id/extend-subscription')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async extendSubscription(
    @Request() req: any,
    @Param('id') orgId: string,
    @Body() data: { planId?: string, paymentReferenceId?: string },
  ) {
    const org = await this.organizationsService.extendSubscription(orgId, data);
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: orgId,
      action: 'Organization Subscription Extended',
      targetId: org.id,
      metadata: { name: org.name, newExpiresAt: org.subscriptionExpiresAt },
    });
    return org;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ORG_USER')
  async getMyOrganization(@Request() req: any) {
    return this.organizationsService.getOrganizationById(
      req.user.organizationId,
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ORG_USER')
  async updateMyOrganization(
    @Request() req: any,
    @Body() updateData: UpdateOrganizationDto,
  ) {
    const org = await this.organizationsService.updateOrganization(
      req.user.organizationId,
      updateData,
    );
    await this.auditService.createLog({
      actorId: req.user.userId,
      organizationId: req.user.organizationId,
      action: 'Organization Updated',
      targetId: org.id,
      metadata: { name: org.name },
    });
    return org;
  }

  // --- Course Plans ---
  @Get('me/course-plans')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ORG_USER', 'FACULTY')
  async getMyCoursePlans(@Request() req: any) {
    return this.organizationsService.getCoursePlans(req.user.organizationId);
  }

  @Post('me/course-plans')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ORG_USER')
  async createMyCoursePlan(@Request() req: any, @Body() planData: any) {
    return this.organizationsService.createCoursePlan(
      req.user.organizationId,
      planData,
    );
  }

  @Patch('me/course-plans/:planId')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ORG_USER')
  async updateMyCoursePlan(
    @Request() req: any,
    @Param('planId') planId: string,
    @Body() planData: any,
  ) {
    return this.organizationsService.updateCoursePlan(
      req.user.organizationId,
      planId,
      planData,
    );
  }

  @Delete('me/course-plans/:planId')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ORG_USER')
  async deleteMyCoursePlan(
    @Request() req: any,
    @Param('planId') planId: string,
  ) {
    return this.organizationsService.deleteCoursePlan(
      req.user.organizationId,
      planId,
    );
  }

  @Post('register')
  @ApiOperation({ summary: 'Public endpoint to register a new organization and admin' })
  async registerOrganization(@Body() registrationData: any) {
    return this.organizationsService.registerOrganization(registrationData);
  }
}
