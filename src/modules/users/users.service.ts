import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { Organization, OrganizationDocument } from '../organizations/schemas/org.schema';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Organization.name) private organizationModel: Model<OrganizationDocument>,
  ) {}

  async createUser(organizationId: string, userData: any) {
    const { email, password, fullName, userType, mobile } = userData;

    const existingUser = await this.userModel.findOne({ email, organizationId });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const normalizedMobile = typeof mobile === 'string' && mobile.trim() ? mobile.trim() : undefined;

    const user = new this.userModel({
      email,
      passwordHash,
      fullName,
      userType: userType || 'ORG_USER',
      status: 'ACTIVE', // Admin created, immediately active
      organizationId,
      mobile: normalizedMobile,
    });

    await user.save();
    return { message: 'User created successfully', userId: user._id };
  }

  async createStudent(organizationId: string, studentData: any) {
    const { email, password, fullName, mobile } = studentData;

    const organization = await this.organizationModel.findOne({ _id: organizationId, isDeleted: false });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (organization.subscriptionConfig?.expiresAt && new Date(organization.subscriptionConfig.expiresAt) < new Date()) {
      throw new BadRequestException('Organization subscription has expired');
    }
    if (organization.subscriptionConfig?.maxStudents) {
      const studentCount = await this.userModel.countDocuments({ organizationId, userType: 'STUDENT', isDeleted: false });
      if (studentCount >= organization.subscriptionConfig.maxStudents) {
        throw new BadRequestException('Organization student limit reached');
      }
    }

    const existingUser = await this.userModel.findOne({ email, organizationId });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const normalizedMobile = typeof mobile === 'string' && mobile.trim() ? mobile.trim() : undefined;

    const student = new this.userModel({
      email,
      passwordHash,
      fullName,
      userType: 'STUDENT',
      status: 'ACTIVE', // Admin created student is active
      organizationId,
      mobile: normalizedMobile,
    });

    await student.save();
    return { message: 'Student created successfully', userId: student._id };
  }

  async getUsersByOrg(organizationId: string, queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = { organizationId, isDeleted: false };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      this.userModel.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.userModel.countDocuments(query),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async updateUserStatus(userId: string, organizationId: string | undefined, status: string) {
    const query: any = { _id: userId, isDeleted: false };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const user = await this.userModel.findOneAndUpdate(
      query,
      { $set: { status } },
      { new: true },
    ).select('-passwordHash -refreshTokens');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async softDeleteUser(userId: string, organizationId: string | undefined) {
    const query: any = { _id: userId, isDeleted: false };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    const user = await this.userModel.findOneAndUpdate(
      query,
      { $set: { isDeleted: true, status: 'INACTIVE' } },
      { new: true },
    ).select('-passwordHash -refreshTokens');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User soft deleted successfully' };
  }

  async getUsers(queryDto: PaginationQueryDto = {} as PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = { isDeleted: false };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      this.userModel.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.userModel.countDocuments(query),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getUserById(userId: string) {
    const user = await this.userModel.findById(userId).select('-passwordHash -refreshTokens');
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  async updateUser(userId: string, updateData: any) {
    const user = await this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).select('-passwordHash -refreshTokens');
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }
}
