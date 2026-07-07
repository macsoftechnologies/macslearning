import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async createUser(organizationId: string, userData: any) {
    const { email, password, fullName, userType, mobile } = userData;

    const existingUser = await this.userModel.findOne({ email });
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
    const { email, password, fullName, mobile, regionId } = studentData;

    const existingUser = await this.userModel.findOne({ email });
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
      regionId,
    });

    await student.save();
    return { message: 'Student created successfully', userId: student._id };
  }

  async createSuperAdminTeamMember(adminData: any) {
    const { email, password, fullName, mobile, modulePermissions } = adminData;

    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const normalizedMobile = typeof mobile === 'string' && mobile.trim() ? mobile.trim() : undefined;

    const adminUser = new this.userModel({
      email,
      passwordHash,
      fullName,
      userType: 'SUPER_ADMIN',
      status: 'ACTIVE',
      organizationId: null, // Super Admins don't belong to a specific org
      mobile: normalizedMobile,
      modulePermissions: modulePermissions || [],
    });

    await adminUser.save();
    return { message: 'Super Admin team member created successfully', userId: adminUser._id };
  }

  async getSuperAdminTeam(queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = { userType: 'SUPER_ADMIN', isDeleted: false };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      this.userModel.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.userModel.countDocuments(query),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
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
      this.userModel.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.userModel.countDocuments(query),
    ]);

    if (data.length > 0) {
      const facultyIds = data.map(u => u._id.toString());
      const courses = await this.userModel.db.collection('courses').aggregate([
        { $match: { instructorIds: { $in: facultyIds.map(id => new Types.ObjectId(id)) }, organizationId, isDeleted: false } },
        { $unwind: '$instructorIds' },
        { $match: { instructorIds: { $in: facultyIds.map(id => new Types.ObjectId(id)) } } },
        { $group: { _id: '$instructorIds', count: { $sum: 1 } } }
      ]).toArray();
      
      const countsMap: Record<string, number> = {};
      courses.forEach(c => countsMap[c._id.toString()] = c.count);
      
      data.forEach(u => {
        (u as any).coursesCount = countsMap[u._id.toString()] || 0;
      });
    }

    return createPaginatedResponse(data, totalItems, page, limit);
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
    const user = await this.userModel.findById(userId).populate('organizationId', 'name code slug').select('-passwordHash -refreshTokens');
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
