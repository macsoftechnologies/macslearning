import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrganizationAdminDto {
  @ApiProperty({ description: 'Admin user email address' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Admin user password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Admin full name' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({ description: 'Admin mobile phone number' })
  @IsString()
  @IsOptional()
  mobile?: string;
}

export class CreateOrganizationDto {
  @ApiProperty({ description: 'Organization name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Organization code', example: 'ACME' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Organization domain' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ description: 'Logo URL for the organization' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Custom theme colors for the organization' })
  @IsOptional()
  themeColors?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Contact information for the organization' })
  @IsOptional()
  contactInfo?: { email?: string; phone?: string; address?: string };

  @ApiPropertyOptional({ description: 'Subscription configuration for the organization' })
  @IsOptional()
  subscriptionConfig?: {
    planId?: string;
    planType?: string;
    billingCycle?: string;
    maxStudents?: number;
    maxStorageGB?: number;
    expiresAt?: Date;
  };

  @ApiPropertyOptional({ description: 'Initial admin user for the new organization', type: CreateOrganizationAdminDto })
  @ValidateNested()
  @Type(() => CreateOrganizationAdminDto)
  @IsOptional()
  adminUser?: CreateOrganizationAdminDto;
}

export class UpdateOrganizationStatusDto {
  @IsEnum(['ACTIVE', 'SUSPENDED', 'INACTIVE'])
  status: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Organization name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Organization domain' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ description: 'Logo URL for the organization' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Custom theme colors for the organization' })
  @IsOptional()
  themeColors?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Contact information for the organization' })
  @IsOptional()
  contactInfo?: { email?: string; phone?: string; address?: string };
}
