import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { StudentsModule } from './modules/students/students.module';
import { CoursesModule } from './modules/courses/courses.module';
import { EnrollmentModule } from './modules/enrollment/enrollment.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ResultsModule } from './modules/results/results.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ContentModule } from './modules/content/content.module';
import { ProgressModule } from './modules/progress/progress.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { DiscussionModule } from './modules/discussion/discussion.module';
import { AuditModule } from './modules/audit/audit.module';
import { CategoryModule } from './modules/category/category.module';
import { SubscriptionPlansModule } from './modules/subscription-plans/subscription-plans.module';
import { RegionsModule } from './modules/regions/regions.module';
import { FacultyModule } from './modules/faculty/faculty.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: configService.get<string>('REDIS_URL'),
      }),
      inject: [ConfigService],
    }),
    AuthModule, UsersModule, OrganizationsModule, StudentsModule, CoursesModule, EnrollmentModule, PaymentModule, ExamsModule, ResultsModule, CertificatesModule, NotificationsModule, ReportsModule, ContentModule, ProgressModule, AssignmentsModule, DiscussionModule, AuditModule, CategoryModule, SubscriptionPlansModule, RegionsModule, FacultyModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
