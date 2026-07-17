import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsOptional()
  regionalPrices?: any[];

  @IsNumber()
  @IsOptional()
  durationInDays?: number;

  @IsNumber()
  @IsOptional()
  maxUsers?: number;

  @IsNumber()
  @IsOptional()
  storageGB?: number;

  @IsOptional()
  features?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSubscriptionPlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsOptional()
  regionalPrices?: any[];

  @IsNumber()
  @IsOptional()
  durationInDays?: number;

  @IsNumber()
  @IsOptional()
  maxUsers?: number;

  @IsNumber()
  @IsOptional()
  storageGB?: number;

  @IsOptional()
  features?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
