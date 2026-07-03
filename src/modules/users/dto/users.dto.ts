import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'User role type', enum: ['ORG_USER', 'FACULTY', 'STUDENT'] })
  @IsEnum(['ORG_USER', 'FACULTY', 'STUDENT'])
  @IsOptional()
  userType?: string;

  @ApiPropertyOptional({ description: 'Organization ID for SUPER_ADMIN when creating users across organizations' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Mobile phone number' })
  @IsString()
  @IsOptional()
  mobile?: string;
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
}

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'New status for the user', enum: ['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'REJECTED'] })
  @IsEnum(['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'REJECTED'])
  status: string;
}
