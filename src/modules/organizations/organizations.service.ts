import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/org.entity';
import { CoursePlan } from './entities/course-plan.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { SubscriptionPlan } from '../subscription-plans/entities/subscription-plan.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(CoursePlan)
    private coursePlanRepository: Repository<CoursePlan>,
    @InjectRepository(SubscriptionPlan)
    private subscriptionPlanRepository: Repository<SubscriptionPlan>,
    private usersService: UsersService,
  ) {}

  async createOrganization(orgData: any) {
    const planId = orgData?.subscriptionPlanId;
    let resolvedSubscriptionConfig = orgData?.subscriptionConfig;

    if (planId) {
      const plan = await this.subscriptionPlanRepository.findOne({
        where: { id: planId },
      });
      if (plan) {
        const startDate = new Date();
        const expiresAt = new Date(
          startDate.getTime() +
            (plan.durationInDays || 30) * 24 * 60 * 60 * 1000,
        );

        resolvedSubscriptionConfig = {
          planId: plan.id,
          planType: plan.code,
          durationInDays: plan.durationInDays || 30,
          maxStudents: plan.maxUsers ?? 0,
          maxStorageGB: plan.storageGB ?? 0,
          expiresAt,
        };
      }
    }

    const domain = orgData.domain || `${orgData.code.toLowerCase()}.lms.com`;
    const organizationPayload = {
      ...orgData,
      domain,
      slug: orgData.code.toLowerCase(),
      loginUrl: `/${orgData.code.toLowerCase()}/login`,
      contactInfo: {
        email: orgData.contactEmail,
        phone: orgData.contactPhone,
        address: orgData.address,
      },
      subscriptionConfig: resolvedSubscriptionConfig,
    };

    const org = this.orgRepository.create(organizationPayload);
    const savedOrg = await this.orgRepository.save(org as any);

    if (orgData.adminEmail && orgData.adminPassword) {
      try {
        await this.usersService.createUser(savedOrg.id, {
          email: orgData.adminEmail,
          password: orgData.adminPassword,
          fullName: orgData.adminFullName || 'Org Admin',
          mobile: orgData.adminMobile,
          userType: 'ORG_USER',
        });
      } catch (error) {
        // Rollback: delete the organization if admin creation fails
        await this.orgRepository.delete(savedOrg.id);
        throw error;
      }
    }

    return savedOrg;
  }

  async getOrganizations(queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orgRepository
      .createQueryBuilder('org')
      .where('org.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('org.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere('org.name LIKE :search', { search: `%${search}%` });
    }

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getOrganizationById(id: string) {
    const org = await this.orgRepository.findOne({
      where: { id, isDeleted: false },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async getOrganizationBySlugForPublic(slug: string) {
    const org = await this.orgRepository.findOne({
      where: { slug, isDeleted: false, status: 'ACTIVE' },
      select: { id: true, name: true, logoUrl: true, themeColors: true, slug: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateOrganization(id: string, updateData: any) {
    await this.orgRepository.update({ id, isDeleted: false }, updateData);
    const org = await this.orgRepository.findOne({
      where: { id, isDeleted: false },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateStatus(orgId: string, status: string) {
    await this.orgRepository.update(orgId, { status });
    const org = await this.orgRepository.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  // --- Course Plans ---
  async createCoursePlan(organizationId: string, planData: any) {
    const plan = this.coursePlanRepository.create({
      ...planData,
      organizationId,
    });
    return this.coursePlanRepository.save(plan);
  }

  async getCoursePlans(organizationId: string) {
    return this.coursePlanRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateCoursePlan(
    organizationId: string,
    planId: string,
    planData: any,
  ) {
    await this.coursePlanRepository.update(
      { id: planId, organizationId },
      planData,
    );
    const plan = await this.coursePlanRepository.findOne({
      where: { id: planId, organizationId },
    });
    if (!plan) throw new NotFoundException('Course plan not found');
    return plan;
  }

  async deleteCoursePlan(organizationId: string, planId: string) {
    const result = await this.coursePlanRepository.delete({
      id: planId,
      organizationId,
    });
    if (result.affected === 0)
      throw new NotFoundException('Course plan not found');
    return { success: true };
  }
}
