import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsOptional()
  themeColors?: Record<string, string>;

  @IsString()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsOptional()
  contactInfo?: { email?: string; phone?: string; address?: string };

  @IsString()
  @IsOptional()
  subscriptionPlanId?: string;

  @IsString()
  @IsOptional()
  adminFullName?: string;

  @IsString()
  @IsOptional()
  adminEmail?: string;

  @IsString()
  @IsOptional()
  adminPassword?: string;

  @IsString()
  @IsOptional()
  adminMobile?: string;

  @IsOptional()
  subscriptionConfig?: {
    planId?: string;
    planType?: string;
    durationInDays?: number;
    maxStudents?: number;
    maxStorageGB?: number;
    expiresAt?: Date;
  };

  @IsEnum(['PAID', 'PENDING', 'OVERDUE'])
  @IsOptional()
  paymentStatus?: string;

  @IsOptional()
  lastPaymentDate?: Date;

  @IsString()
  @IsOptional()
  paymentReferenceId?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

export class UpdateOrganizationStatusDto {
  @IsEnum(['ACTIVE', 'SUSPENDED', 'INACTIVE'])
  status: string;
}

import { PartialType } from '@nestjs/swagger';
export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
