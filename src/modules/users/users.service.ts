import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
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
    const { email, password, fullName, mobile, regionId } = studentData;

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
      queryBuilder.andWhere('user.userType = :userType', { userType });
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

    // Complex aggregation on unstructured courses collection since we haven't migrated courses yet.
    // For now we'll do a placeholder since courses uses MongoDB ObjectID arrays.
    // This will be fully fixed when Courses module is migrated to MySQL.
    const safeData = data.map((user) => {
      const { passwordHash, refreshTokens, ...rest } = user;
      return { ...rest, coursesCount: 0 };
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

    const safeData = data.map((user) => {
      const { passwordHash, refreshTokens, ...rest } = user;
      return {
        ...rest,
        organizationName: rest.organizationId ? orgsMap[rest.organizationId] : null
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
    if (user.organizationId) {
      try {
        const orgRepo = this.dataSource.getRepository('Organization');
        const org = await orgRepo.findOne({
          where: { id: user.organizationId, isDeleted: false }
        });
        if (org) {
          organizationName = org.name;
          organizationSlug = org.slug;
        }
      } catch (err) {
        // Ignore
      }
    }

    const { passwordHash, refreshTokens, ...safeUser } = user;
    return { ...safeUser, organizationName, organizationSlug };
  }

  async updateUser(userId: string, updateData: any) {
    await this.userRepository.update(userId, updateData);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    let organizationName = null;
    let organizationSlug = null;
    if (user.organizationId) {
      try {
        const orgRepo = this.dataSource.getRepository('Organization');
        const org = await orgRepo.findOne({
          where: { id: user.organizationId, isDeleted: false }
        });
        if (org) {
          organizationName = org.name;
          organizationSlug = org.slug;
        }
      } catch (err) {
        // Ignore
      }
    }

    const { passwordHash, refreshTokens, ...safeUser } = user;
    return { ...safeUser, organizationName, organizationSlug };
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
}
