import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>
  ) {}

  async createLog(entry: { organizationId?: string | Types.ObjectId; actorId: string | Types.ObjectId; action: string; targetId?: string | Types.ObjectId; metadata?: any }) {
    try {
      const log = new this.auditLogModel(entry);
      await log.save();
      return log;
    } catch (err) {
      console.error('Failed to create audit log', err);
      // Fail silently to avoid interrupting the main flow
      return null;
    }
  }

  async getLogs(options?: { limit?: number; page?: number; organizationId?: string }) {
    const limit = options?.limit || 50;
    const page = options?.page || 1;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (options?.organizationId) {
      query.organizationId = options.organizationId;
    }

    const logs = await this.auditLogModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actorId', 'fullName email userType')
      .populate('organizationId', 'name')
      .exec();

    const total = await this.auditLogModel.countDocuments(query);

    return {
      data: logs,
      total,
      page,
      limit,
    };
  }
}
