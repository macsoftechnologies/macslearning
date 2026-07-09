import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    description: 'User role type',
    enum: ['SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT', 'FINANCE'],
  })
  @IsEnum(['SUPER_ADMIN', 'ORG_USER', 'FACULTY', 'STUDENT', 'FINANCE'])
  @IsOptional()
  userType?: string;

  @ApiPropertyOptional({
    description:
      'Organization ID for SUPER_ADMIN when creating users across organizations',
  })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Mobile phone number' })
  @IsString()
  @IsOptional()
  mobile?: string;

  @ApiPropertyOptional({
    description: 'Array of permissions assigned to this user',
  })
  @IsOptional()
  modulePermissions?: string[];
}

export class CreateSuperAdminTeamDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({ description: 'Mobile phone number' })
  @IsString()
  @IsOptional()
  mobile?: string;

  @ApiProperty({
    description:
      'Array of permissions assigned to this Super Admin team member',
  })
  @IsOptional()
  modulePermissions?: string[];
}

export class CreateStudentDto {
  @ApiProperty({ description: 'Student email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Student password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Full name of the student' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({ description: 'Mobile phone number' })
  @IsString()
  @IsOptional()
  mobile?: string;

  @ApiProperty({ description: 'Region ID for pricing and grouping' })
  @IsString()
  @IsNotEmpty()
  regionId: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Updated full name' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Updated mobile number' })
  @IsString()
  @IsOptional()
  mobile?: string;

  @ApiPropertyOptional({ description: 'Job title or designation' })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiPropertyOptional({ description: 'Region ID' })
  @IsString()
  @IsOptional()
  regionId?: string;

  @ApiPropertyOptional({
    description: 'Array of permissions assigned to this user',
  })
  @IsOptional()
  modulePermissions?: string[];
}

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'New status for the user',
    enum: ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'REJECTED'],
  })
  @IsEnum(['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'REJECTED'])
  status: string;
}
