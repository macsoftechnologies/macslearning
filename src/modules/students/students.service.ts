import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class StudentsService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async getAllStudents(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = {
      organizationId,
      userType: 'STUDENT',
      isDeleted: false,
    };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, totalItems] = await Promise.all([
      this.userModel.find(query).populate('regionId', 'name').select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.userModel.countDocuments(query),
    ]);

    if (data.length > 0) {
      const { Types } = require('mongoose');
      const studentIds = data.map(s => new Types.ObjectId(s._id.toString()));
      const enrollments = await this.userModel.db.collection('enrollments').aggregate([
        { $match: { studentId: { $in: studentIds }, organizationId: new Types.ObjectId(organizationId), status: 'ACTIVE' } },
        { $group: { _id: '$studentId', count: { $sum: 1 } } }
      ]).toArray();
      
      const countsMap: Record<string, number> = {};
      enrollments.forEach(e => countsMap[e._id.toString()] = e.count);
      
      data.forEach(s => {
        (s as any).enrolledCoursesCount = countsMap[s._id.toString()] || 0;
      });
    }

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getStudentById(studentId: string, organizationId: string) {
    const student = await this.userModel.findOne({
      _id: studentId,
      organizationId,
      userType: 'STUDENT',
      isDeleted: false,
    }).select('-passwordHash');
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async updateStudent(studentId: string, organizationId: string, updateData: any) {
    const student = await this.userModel.findOneAndUpdate(
      { _id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
      { $set: updateData },
      { new: true }
    ).select('-passwordHash');
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async deleteStudent(studentId: string, organizationId: string) {
    const student = await this.userModel.findOneAndUpdate(
      { _id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!student) throw new NotFoundException('Student not found');
    return { message: 'Student deleted successfully' };
  }

  async getPendingStudents(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = {
      organizationId,
      userType: 'STUDENT',
      status: 'PENDING',
      isDeleted: false,
    };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, totalItems] = await Promise.all([
      this.userModel.find(query).populate('regionId', 'name').select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.userModel.countDocuments(query),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async approveStudent(studentId: string, adminId: string, organizationId?: string) {
    const student = await this.userModel.findOne({
      _id: studentId,
      ...(organizationId ? { organizationId } : {}),
      userType: 'STUDENT',
      status: 'PENDING',
    });
    if (!student) {
      throw new NotFoundException('Pending student not found');
    }

    student.status = 'ACTIVE';
    student.approvedBy = adminId as any;
    student.approvedAt = new Date();

    await student.save();

    // In a real implementation, send approval email here
    
    return { message: 'Student approved successfully', student };
  }

  async rejectStudent(studentId: string, adminId: string, reason: string, organizationId?: string) {
    const student = await this.userModel.findOne({
      _id: studentId,
      ...(organizationId ? { organizationId } : {}),
      userType: 'STUDENT',
      status: 'PENDING',
    });
    if (!student) {
      throw new NotFoundException('Pending student not found');
    }

    student.status = 'REJECTED';
    student.rejectionReason = reason;
    student.rejectedBy = adminId as any;
    student.rejectedAt = new Date();

    await student.save();

    // In a real implementation, send rejection email here

    return { message: 'Student rejected successfully', student };
  }
}

