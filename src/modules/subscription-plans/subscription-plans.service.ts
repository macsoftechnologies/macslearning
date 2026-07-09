import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private subscriptionPlanRepository: Repository<SubscriptionPlan>,
  ) {}

  async createSubscriptionPlan(planData: any) {
    const plan = this.subscriptionPlanRepository.create({
      ...planData,
      isActive: planData.isActive ?? true,
      isDeleted: false,
    });
    return this.subscriptionPlanRepository.save(plan);
  }

  async getSubscriptionPlans() {
    return this.subscriptionPlanRepository.find({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getSubscriptionPlanById(planId: string) {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId },
    });
    if (!plan || plan.isDeleted) {
      throw new NotFoundException('Subscription plan not found');
    }
    return plan;
  }

  async updateSubscriptionPlan(planId: string, updateData: any) {
    await this.subscriptionPlanRepository.update(
      { id: planId, isDeleted: false },
      updateData,
    );
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId, isDeleted: false },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return plan;
  }

  async deleteSubscriptionPlan(planId: string) {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: { id: planId, isDeleted: false },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    await this.subscriptionPlanRepository.update(
      { id: planId },
      { isDeleted: true },
    );

    return { message: 'Subscription plan deleted successfully' };
  }
}
