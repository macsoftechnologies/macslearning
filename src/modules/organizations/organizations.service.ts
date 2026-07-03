import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Organization, OrganizationDocument } from './schemas/org.schema';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';
import { SubscriptionPlan, SubscriptionPlanDocument } from '../subscription-plans/schemas/subscription-plan.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {}

  async createOrganization(orgData: any) {
    const requestedPlanType = orgData?.subscriptionConfig?.planType?.toUpperCase();
    let resolvedSubscriptionConfig = orgData?.subscriptionConfig;

    if (requestedPlanType) {
      const plan = await this.subscriptionPlanModel.findOne({ code: requestedPlanType });
      if (plan) {
        const startDate = new Date();
        const expiresAt = this.calculateExpiryDate(startDate, plan.billingCycle || 'MONTHLY');

        resolvedSubscriptionConfig = {
          planId: plan._id,
          planType: plan.code,
          billingCycle: plan.billingCycle || 'MONTHLY',
          maxStudents: plan.features?.maxStudents ?? 0,
          maxStorageGB: plan.features?.maxStorageGB ?? 0,
          expiresAt,
        };
      }
    }

    const slug = this.generateOrganizationSlug(orgData?.name);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const loginUrl = `${frontendUrl.replace(/\/$/, '')}/login/${slug}`;

    const organizationPayload = {
      ...orgData,
      slug,
      loginUrl,
      subscriptionConfig: resolvedSubscriptionConfig,
    };

    const organization = await this.orgModel.create(organizationPayload);

    if (orgData?.adminUser) {
      const existingUser = await this.userModel.findOne({
        email: orgData.adminUser.email,
        organizationId: organization._id,
      });
      if (existingUser) {
        throw new BadRequestException('Admin user with this email already exists for the organization');
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(orgData.adminUser.password, salt);
      const adminUser = new this.userModel({
        email: orgData.adminUser.email,
        passwordHash,
        fullName: orgData.adminUser.fullName,
        mobile: orgData.adminUser.mobile,
        userType: 'ORG_USER',
        status: 'ACTIVE',
        organizationId: organization._id,
      });
      await adminUser.save();
    }

    return organization;
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

  private generateOrganizationSlug(name?: string): string {
    return (name || 'organization')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private calculateExpiryDate(startDate: Date, billingCycle: string): Date {
    const endDate = new Date(startDate);

    switch (billingCycle?.toUpperCase()) {
      case 'QUARTERLY':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'HALF_YEARLY':
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      case 'YEARLY':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case 'MONTHLY':
      default:
        endDate.setMonth(endDate.getMonth() + 1);
        break;
    }

    return endDate;
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

  async getOrganizationById(orgId: string) {
    const org = await this.orgModel.findOne({ _id: orgId, isDeleted: false });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateOrganization(orgId: string, updateData: any) {
    const updateFields: any = {};
    for (const [key, value] of Object.entries(updateData || {})) {
      if (value !== undefined) {
        updateFields[key] = value;
      }
    }

    const org = await this.orgModel.findOneAndUpdate(
      { _id: orgId, isDeleted: false },
      { $set: updateFields },
      { new: true }
    );
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }
}
