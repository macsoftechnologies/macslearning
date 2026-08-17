import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Organization } from '../organizations/entities/org.entity';
import { Region } from '../regions/entities/region.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { FacultyService } from '../faculty/faculty.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(StudentProfile)
    private studentProfileRepository: Repository<StudentProfile>,
    private facultyService: FacultyService,
    private dataSource: DataSource,
  ) {}

  async createUser(organizationId: string, userData: any) {
    const { email, password, fullName, userType, mobile, modulePermissions } = userData;

    const existingUser = await this.userRepository.findOne({
      where: { email, organizationId },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const normalizedMobile =
      typeof mobile === 'string' && mobile.trim() ? mobile.trim() : undefined;

    const user = this.userRepository.create({
      email,
      passwordHash,
      fullName,
      userType: userType || 'ORG_USER',
      status: 'ACTIVE',
      organizationId,
      mobile: normalizedMobile,
      modulePermissions: Array.isArray(modulePermissions) && modulePermissions.length > 0
        ? modulePermissions
        : undefined,
    });

    await this.userRepository.save(user);
    return { message: 'User created successfully', userId: user.id };
  }

  async createStudent(organizationId: string, studentData: any) {
    const { email, password, fullName, mobile, regionId, customProfile } = studentData;

    const existingUser = await this.userRepository.findOne({
      where: { email, organizationId },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const normalizedMobile =
      typeof mobile === 'string' && mobile.trim() ? mobile.trim() : undefined;

    const student = this.userRepository.create({
      email,
      passwordHash,
      fullName,
      userType: 'STUDENT',
      status: 'ACTIVE',
      organizationId,
      mobile: normalizedMobile,
      regionId,
    });

    const profilePayload = { ...studentData };
    // Remove base user fields from profile payload
    const baseFields = ['email', 'password', 'fullName', 'mobile', 'regionId', 'customProfile'];
    for (const field of baseFields) {
      delete profilePayload[field];
    }
    
    // Fallback if frontend sends nested customProfile anyway
    const customProfileFields = studentData.customProfile || {};
    
    student.customProfile = {
      ...profilePayload,
      ...customProfileFields
    };

    await this.userRepository.save(student);

    return { message: 'Student created successfully', userId: student.id };
  }

  async createSuperAdminTeamMember(adminData: any) {
    const { email, password, fullName, mobile, modulePermissions } = adminData;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const normalizedMobile =
      typeof mobile === 'string' && mobile.trim() ? mobile.trim() : undefined;

    const adminUser = this.userRepository.create({
      email,
      passwordHash,
      fullName,
      userType: 'SUPER_ADMIN',
      status: 'ACTIVE',
      mobile: normalizedMobile,
      modulePermissions: modulePermissions || [],
    });

    await this.userRepository.save(adminUser);
    return {
      message: 'Super Admin team member created successfully',
      userId: adminUser.id,
    };
  }

  async getSuperAdminTeam(queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.userType = :userType', { userType: 'SUPER_ADMIN' })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    // Do not return password hash
    const safeData = data.map((user) => {
      const { passwordHash, refreshTokens, ...rest } = user;
      return rest;
    });

    return createPaginatedResponse(safeData, totalItems, page, limit);
  }

  async getUsersByOrg(organizationId: string, queryDto: PaginationQueryDto & { userType?: string }) {
    const { page = 1, limit = 10, search, userType } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.organizationId = :organizationId', { organizationId })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false });

    if (userType) {
      if (userType.includes(',')) {
        const types = userType.split(',');
        queryBuilder.andWhere('user.userType IN (:...userTypes)', { userTypes: types });
      } else {
        queryBuilder.andWhere('user.userType = :userType', { userType });
      }
    }

    queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    let coursesCountMap: Record<string, number> = {};
    if (userType === 'FACULTY' || !userType) {
      try {
        const courseRepo = this.dataSource.getRepository('Course');
        const courses = await courseRepo.find({
          where: { organizationId, isDeleted: false },
          select: { id: true, instructorIds: true },
        });

        data.forEach((u) => {
          coursesCountMap[u.id] = 0;
        });

        courses.forEach((c) => {
          if (c.instructorIds && Array.isArray(c.instructorIds)) {
            c.instructorIds.forEach((instId: string) => {
              if (coursesCountMap[instId] !== undefined) {
                coursesCountMap[instId]++;
              }
            });
          } else if (c.instructorIds && typeof c.instructorIds === 'string') {
            try {
              const parsed = JSON.parse(c.instructorIds);
              if (Array.isArray(parsed)) {
                parsed.forEach((instId: string) => {
                  if (coursesCountMap[instId] !== undefined) {
                    coursesCountMap[instId]++;
                  }
                });
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        });
      } catch (err) {
        // Ignore if Course repo is not found
      }
    }

    let regionsMap: Record<string, any> = {};
    try {
      const regionIds = Array.from(new Set(data.map(u => u.regionId).filter(id => id)));
      if (regionIds.length > 0) {
        const regionRepo = this.dataSource.getRepository(Region);
        const regions = await regionRepo.find({
          where: { id: In(regionIds) },
          select: { id: true, name: true }
        });
        regions.forEach(r => {
          regionsMap[r.id] = r;
        });
      }
    } catch (e) { console.error('REGION ERROR:', e); }

    const safeData = data.map((user) => {
      const { passwordHash, refreshTokens, ...rest } = user;
      return { 
        ...rest, 
        coursesCount: coursesCountMap[user.id] || 0,
        region: rest.regionId ? regionsMap[rest.regionId] : null
      };
    });

    return createPaginatedResponse(safeData, totalItems, page, limit);
  }

  async getUsers(queryDto: PaginationQueryDto & { userType?: string; organizationId?: string }) {
    const { page = 1, limit = 10, search, userType, organizationId } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere('user.userType != :rootRole', { rootRole: 'SUPER_ADMIN' });

    if (userType) {
      queryBuilder.andWhere('user.userType = :userType', { userType });
    }

    if (organizationId) {
      queryBuilder.andWhere('user.organizationId = :organizationId', { organizationId });
    }

    queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    let orgsMap: Record<string, string> = {};
    try {
      const orgIds = Array.from(new Set(data.map(u => u.organizationId).filter(id => id)));
      if (orgIds.length > 0) {
        const orgRepo = this.dataSource.getRepository('Organization');
        const orgs = await orgRepo.find({
          where: { id: In(orgIds) },
          select: { id: true, name: true }
        });
        orgs.forEach(org => {
          orgsMap[org.id] = org.name;
        });
      }
    } catch (e) {
      // Ignore if repo not found or other errors
    }

    let regionsMapAll: Record<string, any> = {};
    try {
      const regionIds = Array.from(new Set(data.map(u => u.regionId).filter(id => id)));
      if (regionIds.length > 0) {
        const regionRepo = this.dataSource.getRepository(Region);
        const regions = await regionRepo.find({
          where: { id: In(regionIds) },
          select: { id: true, name: true }
        });
        regions.forEach(r => {
          regionsMapAll[r.id] = r;
        });
      }
    } catch (e) { console.error('REGION ERROR:', e); }

    const safeData = data.map((user) => {
      const { passwordHash, refreshTokens, ...rest } = user;
      return {
        ...rest,
        organizationName: rest.organizationId ? orgsMap[rest.organizationId] : null,
        region: rest.regionId ? regionsMapAll[rest.regionId] : null
      };
    });

    return createPaginatedResponse(safeData, totalItems, page, limit);
  }

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    
    let organizationName = null;
    let organizationSlug = null;
    let organizationLogo = null;
    if (user.organizationId) {
      try {
        const orgRepo = this.dataSource.getRepository('Organization');
        const org = await orgRepo.findOne({
          where: { id: user.organizationId, isDeleted: false }
        });
        if (org) {
          organizationName = org.name;
          organizationSlug = org.slug;
          organizationLogo = org.logoUrl;
        }
      } catch (err) {
        // Ignore
      }
    }

    const { passwordHash, refreshTokens, ...safeUser } = user;
    return { ...safeUser, organizationName, organizationSlug, organizationLogo };
  }

  async updateUser(userId: string, updateData: any, reqUser?: { userType: string; organizationId?: string; isSuperAdminEndpoint?: boolean }) {
    const userToUpdate = await this.userRepository.findOne({ where: { id: userId } });
    if (!userToUpdate) {
      throw new BadRequestException('User not found');
    }

    // Security Check: IDOR prevention for ORG_USER
    if (reqUser?.userType === 'ORG_USER') {
      if (userToUpdate.organizationId !== reqUser.organizationId) {
        throw new UnauthorizedException('You do not have permission to update this user');
      }
      if (userToUpdate.userType === 'SUPER_ADMIN') {
        throw new UnauthorizedException('Organization users cannot update Super Admins');
      }
    }

    // Security Check: Prevent modifying SUPER_ADMIN from regular user endpoints
    if (userToUpdate.userType === 'SUPER_ADMIN' && !reqUser?.isSuperAdminEndpoint) {
      throw new UnauthorizedException('Cannot update Super Admin via this endpoint');
    }

    // We use preload/save to ensure JSON columns are correctly serialized by TypeORM
    const userPreloaded = await this.userRepository.preload({
      id: userId,
      ...updateData
    });
    if (userPreloaded) {
      await this.userRepository.save(userPreloaded);
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    let organizationName = null;
    let organizationSlug = null;
    let organizationLogo = null;
    if (user.organizationId) {
      try {
        const orgRepo = this.dataSource.getRepository('Organization');
        const org = await orgRepo.findOne({
          where: { id: user.organizationId, isDeleted: false }
        });
        if (org) {
          organizationName = org.name;
          organizationSlug = org.slug;
          organizationLogo = org.logoUrl;
        }
      } catch (err) {
        // Ignore
      }
    }

    const { passwordHash, refreshTokens, ...safeUser } = user;
    return { ...safeUser, organizationName, organizationSlug, organizationLogo };
  }

  async findUsersByRole(organizationId: string, userType: string): Promise<string[]> {
    const users = await this.userRepository.find({
      where: {
        organizationId,
        userType,
        status: 'ACTIVE',
        isDeleted: false,
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async getSuperAdminIds(): Promise<string[]> {
    const admins = await this.userRepository.find({
      where: { userType: 'SUPER_ADMIN', status: 'ACTIVE', isDeleted: false },
      select: { id: true },
    });
    return admins.map(a => a.id);
  }

  async suffixOrgAdminEmail(orgId: string, suffix: string) {
    const adminUser = await this.userRepository.findOne({ where: { organizationId: orgId, userType: 'ORG_USER' } });
    if (adminUser) {
      await this.userRepository.update(adminUser.id, {
        email: `${adminUser.email}${suffix}`
      });
    }
  }
}
