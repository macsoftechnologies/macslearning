import { Controller, Post, Body, UseGuards, Request, Get, Param, Patch, Delete, BadRequestException, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateStudentDto, CreateUserDto, UpdateUserDto, UpdateUserStatusDto } from './dto/users.dto';
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
        throw new BadRequestException('organizationId is required when created by SUPER_ADMIN');
      }
      orgId = userData.organizationId;
    }

    return this.usersService.createUser(orgId, userData);
  }

  @Post('students')
  @Roles('ORG_USER')
  async createStudent(@Request() req: any, @Body() studentData: CreateStudentDto) {
    return this.usersService.createStudent(req.user.organizationId, studentData);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @ApiOperation({ summary: 'Update a user account status' })
  async updateUserStatus(@Request() req: any, @Param('id') userId: string, @Body() statusDto: UpdateUserStatusDto) {
    const organizationId = req.user.userType === 'ORG_USER' ? req.user.organizationId : undefined;
    return this.usersService.updateUserStatus(userId, organizationId, statusDto.status);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @ApiOperation({ summary: 'Soft delete a user' })
  async deleteUser(@Request() req: any, @Param('id') userId: string) {
    const organizationId = req.user.userType === 'ORG_USER' ? req.user.organizationId : undefined;
    return this.usersService.softDeleteUser(userId, organizationId);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_USER')
  @ApiOperation({ summary: 'Get all users in organization with pagination and search' })
  async getUsers(@Request() req: any, @Query() query: PaginationQueryDto) {
    if (req.user.userType === 'SUPER_ADMIN') {
      return this.usersService.getUsers(query);
    }
    return this.usersService.getUsersByOrg(req.user.organizationId, query);
  }
}
