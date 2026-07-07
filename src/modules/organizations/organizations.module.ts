import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { Organization, OrganizationSchema } from './schemas/org.schema';
import { CoursePlan, CoursePlanSchema } from './schemas/course-plan.schema';
import { SubscriptionPlan, SubscriptionPlanSchema } from '../subscription-plans/schemas/subscription-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Organization.name, schema: OrganizationSchema }]),
    MongooseModule.forFeature([{ name: CoursePlan.name, schema: CoursePlanSchema }]),
    MongooseModule.forFeature([{ name: SubscriptionPlan.name, schema: SubscriptionPlanSchema }]),
    AuditModule,
    UsersModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService, MongooseModule],
})
export class OrganizationsModule {}
