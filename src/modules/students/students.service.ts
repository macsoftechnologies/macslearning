import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../enrollment/entities/enrollment.entity';
import { Region } from '../regions/entities/region.entity';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
  ) {}

  async getAllStudents(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoin(Region, 'region', 'region.id = user.regionId')
      .where('user.organizationId = :organizationId', { organizationId })
      .andWhere('user.userType = :userType', { userType: 'STUDENT' })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.mobile',
        'user.status',
        'user.createdAt',
        'region.id',
        'region.name',
      ]);

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const dataRaw = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getRawMany();
    const totalItems = await queryBuilder.getCount();

    const data = dataRaw.map((d) => ({
      _id: d.user_id,
      id: d.user_id,
      fullName: d.user_fullName,
      email: d.user_email,
      mobile: d.user_mobile,
      status: d.user_status,
      createdAt: d.user_createdAt,
      regionId: { _id: d.region_id, id: d.region_id, name: d.region_name },
    }));

    if (data.length > 0) {
      const studentIds = data.map((s) => s.id);

      const enrollments = await this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .where('enrollment.organizationId = :organizationId', {
          organizationId,
        })
        .andWhere('enrollment.studentId IN (:...studentIds)', { studentIds })
        .andWhere('enrollment.status = :status', { status: 'ACTIVE' })
        .select('enrollment.studentId', 'studentId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('enrollment.studentId')
        .getRawMany();

      const countsMap: Record<string, number> = {};
      enrollments.forEach(
        (e) => (countsMap[e.studentId] = parseInt(e.count, 10)),
      );

      data.forEach((s) => {
        (s as any).enrolledCoursesCount = countsMap[s.id] || 0;
      });
    }

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getStudentById(studentId: string, organizationId: string) {
    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    delete (student as any).passwordHash;
    return student;
  }

  async updateStudent(
    studentId: string,
    organizationId: string,
    updateData: any,
  ) {
    await this.userRepository.update(
      { id: studentId, organizationId, userType: 'STUDENT', isDeleted: false },
      updateData,
    );
    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    delete (student as any).passwordHash;
    return student;
  }

  async deleteStudent(studentId: string, organizationId: string) {
    const student = await this.userRepository.findOne({
      where: {
        id: studentId,
        organizationId,
        userType: 'STUDENT',
        isDeleted: false,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.userRepository.update({ id: studentId }, { isDeleted: true });
    return { message: 'Student deleted successfully' };
  }

  async getPendingStudents(organizationId: string, queryDto: any) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoin(Region, 'region', 'region.id = user.regionId')
      .where('user.organizationId = :organizationId', { organizationId })
      .andWhere('user.userType = :userType', { userType: 'STUDENT' })
      .andWhere('user.status = :status', { status: 'PENDING' })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.mobile',
        'user.status',
        'user.createdAt',
        'region.id',
        'region.name',
      ]);

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const dataRaw = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getRawMany();
    const totalItems = await queryBuilder.getCount();

    const data = dataRaw.map((d) => ({
      _id: d.user_id,
      id: d.user_id,
      fullName: d.user_fullName,
      email: d.user_email,
      mobile: d.user_mobile,
      status: d.user_status,
      createdAt: d.user_createdAt,
      regionId: { _id: d.region_id, id: d.region_id, name: d.region_name },
    }));

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async approveStudent(
    studentId: string,
    adminId: string,
    organizationId?: string,
  ) {
    const whereClause: any = {
      id: studentId,
      userType: 'STUDENT',
      status: 'PENDING',
    };
    if (organizationId) whereClause.organizationId = organizationId;

    const student = await this.userRepository.findOne({ where: whereClause });
    if (!student) {
      throw new NotFoundException('Pending student not found');
    }

    student.status = 'ACTIVE';
    student.approvedBy = adminId;
    student.approvedAt = new Date();

    await this.userRepository.save(student);

    // In a real implementation, send approval email here

    return { message: 'Student approved successfully', student };
  }

  async rejectStudent(
    studentId: string,
    adminId: string,
    reason: string,
    organizationId?: string,
  ) {
    const whereClause: any = {
      id: studentId,
      userType: 'STUDENT',
      status: 'PENDING',
    };
    if (organizationId) whereClause.organizationId = organizationId;

    const student = await this.userRepository.findOne({ where: whereClause });
    if (!student) {
      throw new NotFoundException('Pending student not found');
    }

    student.status = 'REJECTED';
    student.rejectionReason = reason;
    student.rejectedBy = adminId;
    student.rejectedAt = new Date();

    await this.userRepository.save(student);

    // In a real implementation, send rejection email here

    return { message: 'Student rejected successfully', student };
  }
}
