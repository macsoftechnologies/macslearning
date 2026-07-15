import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsObject,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PricingDto {
  @IsBoolean()
  isPaid: boolean;

  @IsNumber()
  @Type(() => Number)
  amount: number;

  @IsString()
  currency: string;
}

export class RegionPriceDto {
  @IsString()
  @IsNotEmpty()
  regionId: string;

  @IsNumber()
  @Type(() => Number)
  price: number;
}

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  instructorIds?: string[];

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingDto)
  pricing?: PricingDto;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RegionPriceDto)
  regionalPrices?: RegionPriceDto[];

  @IsString()
  @IsNotEmpty()
  coursePlanId: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  validityDays?: number;

  @IsString()
  @IsOptional()
  certificateTemplateId?: string;

  @IsEnum(['AUTO', 'MANUAL_APPROVAL'])
  @IsOptional()
  certificateIssueMode?: string;
}

export class UpdateCourseDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  @IsOptional()
  status?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingDto)
  pricing?: PricingDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  instructorIds?: string[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RegionPriceDto)
  regionalPrices?: RegionPriceDto[];

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  validityDays?: number;

  @IsString()
  @IsOptional()
  certificateTemplateId?: string;

  @IsEnum(['AUTO', 'MANUAL_APPROVAL'])
  @IsOptional()
  certificateIssueMode?: string;
}
