import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  old_password: string;

  @ApiProperty({ description: 'New password', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  new_password: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Email used for login' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password used for login' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Organization code for organization login' })
  @IsOptional()
  @IsString()
  organizationCode?: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsOptional()
  organizationCode?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  regionId?: string;
}
