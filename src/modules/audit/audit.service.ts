import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/org.entity';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async createLog(entry: {
    organizationId?: string;
    actorId: string;
    action: string;
    targetId?: string;
    metadata?: any;
  }) {
    try {
      const log = this.auditLogRepository.create(entry);
      await this.auditLogRepository.save(log);
      return log;
    } catch (err) {
      console.error('Failed to create audit log', err);
      // Fail silently to avoid interrupting the main flow
      return null;
    }
  }

  async getLogs(options?: {
    limit?: number;
    page?: number;
    organizationId?: string;
  }) {
    const limit = options?.limit || 50;
    const page = options?.page || 1;
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoin(User, 'actor', 'actor.id = log.actorId')
      .leftJoin(
        Organization,
        'organization',
        'organization.id = log.organizationId',
      )
      .select([
        'log.*',
        'actor.id as actor_id',
        'actor.fullName as actor_fullName',
        'actor.email as actor_email',
        'actor.userType as actor_userType',
        'organization.id as organization_id',
        'organization.name as organization_name',
      ]);

    if (options?.organizationId) {
      queryBuilder.where('log.organizationId = :organizationId', {
        organizationId: options.organizationId,
      });
    }

    const dataRaw = await queryBuilder
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getRawMany();
    const total = await queryBuilder.getCount();

    const logs = dataRaw.map((l: any) => ({
      ...l,
      actorId: {
        _id: l.actor_id,
        id: l.actor_id,
        fullName: l.actor_fullName,
        email: l.actor_email,
        userType: l.actor_userType,
      },
      organizationId: {
        _id: l.organization_id,
        id: l.organization_id,
        name: l.organization_name,
      },
    }));

    return createPaginatedResponse(logs, total, page, limit);
  }
}
