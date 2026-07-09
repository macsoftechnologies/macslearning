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
import {
  CreateStudentDto,
  CreateUserDto,
  UpdateUserDto,
  CreateSuperAdminTeamDto,
  UpdateUserStatusDto,
} from './dto/users.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Post('super-admin-team')
  @Roles('SUPER_ADMIN')
  async createSuperAdminTeamMember(@Body() adminData: CreateSuperAdminTeamDto) {
    return this.usersService.createSuperAdminTeamMember(adminData);
  }

  @Patch('super-admin-team/:id')
  @Roles('SUPER_ADMIN')
  async updateSuperAdminTeamMember(
    @Param('id') id: string,
    @Body() updateData: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateData);
  }

  @Patch('super-admin-team/:id/status')
  @Roles('SUPER_ADMIN')
  async updateSuperAdminTeamStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateUser(id, { status: statusDto.status });
  }

  @Get('super-admin-team')
  @Roles('SUPER_ADMIN')
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
  @Roles('SUPER_ADMIN', 'ORG_USER')
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
