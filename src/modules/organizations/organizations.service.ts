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

        let finalPrice = 0;
        let finalCurrency = 'USD';
        
        if (plan.regionalPrices && Array.isArray(plan.regionalPrices)) {
           const regionalConfig = plan.regionalPrices.find(rp => rp.regionId === orgData.regionId);
           if (regionalConfig) {
             finalPrice = regionalConfig.price || 0;
             finalCurrency = regionalConfig.currency || 'USD';
           }
        }

        resolvedSubscriptionConfig = {
          planId: plan.id,
          planType: plan.code,
          durationInDays: plan.durationInDays || 30,
          maxStudents: plan.maxUsers ?? 0,
          maxStorageGB: plan.storageGB ?? 0,
          price: finalPrice,
          currency: finalCurrency,
          expiresAt,
          paymentStatus: orgData.paymentStatus,
          lastPaymentDate: orgData.lastPaymentDate,
          paymentReferenceId: orgData.paymentReferenceId,
        };
      }
    }

    const domain = orgData.domain || `${orgData.code.toLowerCase()}.lms.com`;
    const initialStatus = orgData.paymentStatus === 'PENDING' ? 'INACTIVE' : 'ACTIVE';
    const organizationPayload = {
      ...orgData,
      regionId: orgData.regionId,
      status: initialStatus,
      domain,
      slug: orgData.code.toLowerCase(),
      loginUrl: `/${orgData.code.toLowerCase()}/login`,
      contactInfo: {
        email: orgData.contactEmail,
        phone: orgData.contactPhone,
        address: orgData.address,
      },
      subscriptionConfig: resolvedSubscriptionConfig,
      subscriptionExpiresAt: resolvedSubscriptionConfig?.expiresAt,
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

    if (queryDto.filter === 'expiring') {
      const twentyDaysFromNow = new Date();
      twentyDaysFromNow.setDate(twentyDaysFromNow.getDate() + 20);
      queryBuilder.andWhere('org.subscriptionExpiresAt <= :twentyDaysFromNow', { twentyDaysFromNow });
      queryBuilder.andWhere('org.status != :status', { status: 'INACTIVE' });
    } else if (queryDto.filter === 'pending') {
      queryBuilder.andWhere('org.status = :status', { status: 'INACTIVE' });
    } else {
      // By default, do not show PENDING (INACTIVE) organizations
      queryBuilder.andWhere('org.status != :status', { status: 'INACTIVE' });
    }

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getCounts() {
    const twentyDaysFromNow = new Date();
    twentyDaysFromNow.setDate(twentyDaysFromNow.getDate() + 20);

    const pendingCount = await this.orgRepository.count({
      where: { status: 'INACTIVE', isDeleted: false }
    });

    const expiringCount = await this.orgRepository.createQueryBuilder('org')
      .where('org.isDeleted = false')
      .andWhere('org.status != :status', { status: 'INACTIVE' })
      .andWhere('org.subscriptionExpiresAt <= :twentyDaysFromNow', { twentyDaysFromNow })
      .getCount();

    return { pendingCount, expiringCount };
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

  async deleteOrganization(id: string) {
    const org = await this.orgRepository.findOne({ where: { id, isDeleted: false } });
    if (!org) throw new NotFoundException('Organization not found');
    await this.orgRepository.update(id, { isDeleted: true });
    return { success: true };
  }

  async extendSubscription(orgId: string, data: { planId?: string, paymentReferenceId?: string }) {
    const org = await this.getOrganizationById(orgId);
    let plan = null;
    let planIdToUse = data.planId || org.subscriptionConfig?.planId;
    
    if (planIdToUse) {
      plan = await this.subscriptionPlanRepository.findOne({ where: { id: planIdToUse } });
    }

    if (!plan) throw new NotFoundException('Subscription plan not found');

    const durationDays = plan.durationInDays || 30;
    
    // If it's already expired or has no expiry, start from today. Otherwise, add to the current expiry.
    const currentExpiry = org.subscriptionExpiresAt ? new Date(org.subscriptionExpiresAt) : new Date();
    const startDate = currentExpiry < new Date() ? new Date() : currentExpiry;
    
    const newExpiresAt = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000));

    let finalPrice = 0;
    let finalCurrency = 'USD';
    
    if (plan.regionalPrices && Array.isArray(plan.regionalPrices)) {
       const regionalConfig = plan.regionalPrices.find(rp => rp.regionId === org.regionId);
       if (regionalConfig) {
         finalPrice = regionalConfig.price || 0;
         finalCurrency = regionalConfig.currency || 'USD';
       }
    }

    const updatedConfig = {
      ...org.subscriptionConfig,
      planId: plan.id,
      planType: plan.code,
      durationInDays: durationDays,
      maxStudents: plan.maxUsers ?? 0,
      maxStorageGB: plan.storageGB ?? 0,
      price: finalPrice,
      currency: finalCurrency,
      expiresAt: newExpiresAt
    };

    await this.orgRepository.update(orgId, {
      subscriptionConfig: updatedConfig,
      subscriptionExpiresAt: newExpiresAt,
    });

    return this.getOrganizationById(orgId);
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
  async registerOrganization(registrationData: any) {
    const orgData = {
      name: registrationData.orgName,
      code: registrationData.orgCode,
      regionId: registrationData.regionId,
      paymentStatus: 'PENDING',
      subscriptionPlanId: registrationData.planId,
      adminEmail: registrationData.email,
      adminPassword: registrationData.password,
      adminFullName: registrationData.fullName,
      adminMobile: registrationData.mobile,
    };
    return this.createOrganization(orgData);
  }
}
