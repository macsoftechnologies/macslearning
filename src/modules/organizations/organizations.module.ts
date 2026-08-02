import { Module, forwardRef } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsController } from './organizations.controller';
import { PublicOrganizationsController } from './public-organizations.controller';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/org.entity';
import { CoursePlan } from './entities/course-plan.entity';
import { SubscriptionPlan } from '../subscription-plans/entities/subscription-plan.entity';
import { VimeoModule } from '../vimeo/vimeo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    TypeOrmModule.forFeature([CoursePlan]),
    TypeOrmModule.forFeature([SubscriptionPlan]),
    AuditModule,
    UsersModule,
    VimeoModule,
    NotificationsModule,
    TransactionsModule,
  ],
  controllers: [OrganizationsController, PublicOrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService, TypeOrmModule],
})
export class OrganizationsModule {}
