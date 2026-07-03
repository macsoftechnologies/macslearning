import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ description: 'Subscription plan name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Subscription plan code', example: 'BASIC' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Price of the plan' })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Billing cycle type', example: 'MONTHLY' })
  @IsString()
  @IsOptional()
  billingCycle?: string;

  @ApiPropertyOptional({ description: 'Plan features as a key/value object' })
  @IsOptional()
  features?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether the plan is currently active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({ description: 'Subscription plan name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Subscription plan code' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'Price of the plan' })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Billing cycle type' })
  @IsString()
  @IsOptional()
  billingCycle?: string;

  @ApiPropertyOptional({ description: 'Plan features as a key/value object' })
  @IsOptional()
  features?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether the plan is currently active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
