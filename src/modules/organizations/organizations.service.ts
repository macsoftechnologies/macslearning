import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from './schemas/org.schema';
import { CoursePlan, CoursePlanDocument } from './schemas/course-plan.schema';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { SubscriptionPlan, SubscriptionPlanDocument } from '../subscription-plans/schemas/subscription-plan.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    @InjectModel(CoursePlan.name) private coursePlanModel: Model<CoursePlanDocument>,
    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
    private usersService: UsersService,
  ) {}

  async createOrganization(orgData: any) {
    const planId = orgData?.subscriptionPlanId;
    let resolvedSubscriptionConfig = orgData?.subscriptionConfig;

    if (planId) {
      const plan = await this.subscriptionPlanModel.findById(planId);
      if (plan) {
        const startDate = new Date();
        const expiresAt = new Date(startDate.getTime() + (plan.durationInDays || 30) * 24 * 60 * 60 * 1000);

        resolvedSubscriptionConfig = {
          planId: plan._id,
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

    const org = await this.orgModel.create(organizationPayload);

    if (orgData.adminEmail && orgData.adminPassword) {
      await this.usersService.createUser(org._id.toString(), {
        email: orgData.adminEmail,
        password: orgData.adminPassword,
        fullName: orgData.adminFullName || 'Org Admin',
        mobile: orgData.adminMobile,
        userType: 'ORG_USER',
      });
    }

    return org;
  }

  async getOrganizations(queryDto: PaginationQueryDto) {
    const { page = 1, limit = 10, search } = queryDto;
    const query: any = { isDeleted: false };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      this.orgModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.orgModel.countDocuments(query),
    ]);

    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async getOrganizationById(id: string) {
    const org = await this.orgModel.findOne({ _id: id, isDeleted: false });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateOrganization(id: string, updateData: any) {
    const org = await this.orgModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }



  async updateStatus(orgId: string, status: string) {
    const org = await this.orgModel.findByIdAndUpdate(
      orgId,
      { $set: { status } },
      { new: true }
    );
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  // --- Course Plans ---
  async createCoursePlan(organizationId: string, planData: any) {
    return this.coursePlanModel.create({ ...planData, organizationId });
  }

  async getCoursePlans(organizationId: string) {
    return this.coursePlanModel.find({ organizationId }).sort({ createdAt: -1 });
  }

  async updateCoursePlan(organizationId: string, planId: string, planData: any) {
    const plan = await this.coursePlanModel.findOneAndUpdate(
      { _id: planId, organizationId },
      { $set: planData },
      { new: true }
    );
    if (!plan) throw new NotFoundException('Course plan not found');
    return plan;
  }

  async deleteCoursePlan(organizationId: string, planId: string) {
    const plan = await this.coursePlanModel.findOneAndDelete({ _id: planId, organizationId });
    if (!plan) throw new NotFoundException('Course plan not found');
    return { success: true };
  }
}
