import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Patch,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  CreateStudentDto,
  CreateUserDto,
  UpdateUserDto,
  CreateSuperAdminTeamDto,
  UpdateUserStatusDto,
} from './dto/users.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.getUserById(req.user.userId);
  }

  @Patch('me')
  async updateMe(@Request() req: any, @Body() updateData: UpdateUserDto) {
    return this.usersService.updateUser(req.user.userId, updateData);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async createUser(@Request() req: any, @Body() userData: CreateUserDto) {
    let orgId = req.user.organizationId;

    if (req.user.userType === 'SUPER_ADMIN') {
      if (!userData.organizationId) {
        throw new BadRequestException(
          'organizationId is required when created by SUPER_ADMIN',
        );
      }
      orgId = userData.organizationId;
    }

    return this.usersService.createUser(orgId, userData);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  async updateUserData(
    @Request() req: any,
    @Param('id') userId: string,
    @Body() updateData: UpdateUserDto,
  ) {
    // Basic authorization check could be added here if ORG_USER
    // is trying to update a user outside their organization.
    // For now, rely on UI passing valid IDs or add simple check.
    return this.usersService.updateUser(userId, updateData);
  }

  @Post('super-admin-team')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.MANAGE_ROLES)
  async createSuperAdminTeamMember(
    @Request() req: any,
    @Body() adminData: CreateSuperAdminTeamDto,
  ) {
    const res = await this.usersService.createSuperAdminTeamMember(adminData);
    await this.auditService.createLog({
      actorId: req.user.userId,
      action: 'Super Admin Team Member Created',
      targetId: res.userId,
      metadata: { email: adminData.email },
    });
    return res;
  }

  @Patch('super-admin-team/:id')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.MANAGE_ROLES)
  async updateSuperAdminTeamMember(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateData: UpdateUserDto,
  ) {
    const res = await this.usersService.updateUser(id, updateData);
    await this.auditService.createLog({
      actorId: req.user.userId,
      action: 'Super Admin Team Member Updated',
      targetId: id,
      metadata: { updateData },
    });
    return res;
  }

  @Patch('super-admin-team/:id/status')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.MANAGE_ROLES)
  async updateSuperAdminTeamStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() statusDto: UpdateUserStatusDto,
  ) {
    const res = await this.usersService.updateUser(id, { status: statusDto.status });
    await this.auditService.createLog({
      actorId: req.user.userId,
      action: `Super Admin Team Member Status Changed: ${statusDto.status}`,
      targetId: id,
      metadata: { status: statusDto.status },
    });
    return res;
  }

  @Get('super-admin-team')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.MANAGE_ROLES)
  @ApiOperation({
    summary: 'Get all super admin team members with pagination and search',
  })
  async getSuperAdminTeam(@Query() query: PaginationQueryDto) {
    return this.usersService.getSuperAdminTeam(query);
  }

  @Post('students')
  @Roles('ORG_USER')
  async createStudent(
    @Request() req: any,
    @Body() studentData: CreateStudentDto,
  ) {
    return this.usersService.createStudent(
      req.user.organizationId,
      studentData,
    );
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  @ApiOperation({
    summary: 'Get all users in organization with pagination and search',
  })
  async getUsers(@Request() req: any, @Query() query: PaginationQueryDto) {
    if (req.user.userType === 'SUPER_ADMIN') {
      return this.usersService.getUsers(query);
    }
    return this.usersService.getUsersByOrg(req.user.organizationId, query);
  }
}
