import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubscriptionPlan, SubscriptionPlanDocument } from './schemas/subscription-plan.schema';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
  ) {}

  async createSubscriptionPlan(planData: any) {
    const plan = await this.subscriptionPlanModel.create({
      ...planData,
      isActive: planData.isActive ?? true,
      isDeleted: false,
    });

    return plan;
  }

  async getSubscriptionPlans() {
    return this.subscriptionPlanModel.find({ isDeleted: false }).sort({ createdAt: -1 });
  }

  async getSubscriptionPlanById(planId: string) {
    const plan = await this.subscriptionPlanModel.findById(planId);
    if (!plan || plan.isDeleted) {
      throw new NotFoundException('Subscription plan not found');
    }
    return plan;
  }

  async updateSubscriptionPlan(planId: string, updateData: any) {
    const plan = await this.subscriptionPlanModel.findOneAndUpdate(
      { _id: planId, isDeleted: false },
      { $set: updateData },
      { new: true },
    );

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return plan;
  }

  async deleteSubscriptionPlan(planId: string) {
    const plan = await this.subscriptionPlanModel.findOneAndUpdate(
      { _id: planId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true },
    );

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return { message: 'Subscription plan deleted successfully' };
  }
}
