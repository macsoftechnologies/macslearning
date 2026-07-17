import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@ApiTags('Subscription Plans')
@ApiBearerAuth()
@Controller('subscription-plans')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async createSubscriptionPlan(@Body() planData: CreateSubscriptionPlanDto) {
    return this.subscriptionPlansService.createSubscriptionPlan(planData);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async getSubscriptionPlans() {
    return this.subscriptionPlansService.getSubscriptionPlans();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async getSubscriptionPlanById(@Param('id') planId: string) {
    return this.subscriptionPlansService.getSubscriptionPlanById(planId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async updateSubscriptionPlan(
    @Param('id') planId: string,
    @Body() updateData: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionPlansService.updateSubscriptionPlan(
      planId,
      updateData,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async deleteSubscriptionPlan(@Param('id') planId: string) {
    return this.subscriptionPlansService.deleteSubscriptionPlan(planId);
  }
}
