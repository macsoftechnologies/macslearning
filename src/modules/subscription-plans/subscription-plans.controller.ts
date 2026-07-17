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
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async createSubscriptionPlan(@Body() planData: CreateSubscriptionPlanDto) {
    return this.subscriptionPlansService.createSubscriptionPlan(planData);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async getSubscriptionPlans(@Query('regionId') regionId?: string) {
    return this.subscriptionPlansService.getSubscriptionPlans(regionId);
  }

  @Get('public')
  async getPublicSubscriptionPlans(@Query('regionId') regionId?: string) {
    const plans = await this.subscriptionPlansService.getSubscriptionPlans(regionId);
    return plans.filter(p => p.isActive);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async getSubscriptionPlanById(@Param('id') planId: string) {
    return this.subscriptionPlansService.getSubscriptionPlanById(planId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_ORGANIZATIONS)
  async deleteSubscriptionPlan(@Param('id') planId: string) {
    return this.subscriptionPlansService.deleteSubscriptionPlan(planId);
  }
}
