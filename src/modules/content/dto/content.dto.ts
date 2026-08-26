import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateModuleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  order?: number;
}

export class UpdateModuleDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  order?: number;
}

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['VIDEO', 'PDF', 'DOCUMENT', 'TEXT', 'INTERACTIVE', 'MIXED'])
  @IsOptional()
  type?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  contentUrl?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsArray()
  @IsOptional()
  attachments?: any[];

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  orderIndex?: number;

  @IsOptional()
  overlayConfig?: {
    enabled?: boolean;
    imageUrl?: string;
    startSecond?: number;
    durationSeconds?: number;
    position?: string;
    animation?: string;
    customText?: string;
  };
}

export class UpdateLessonDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['VIDEO', 'PDF', 'DOCUMENT', 'TEXT', 'INTERACTIVE', 'MIXED'])
  @IsOptional()
  type?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  order?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  orderIndex?: number;

  @IsString()
  @IsOptional()
  contentUrl?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsArray()
  @IsOptional()
  attachments?: any[];

  @IsOptional()
  overlayConfig?: {
    enabled?: boolean;
    imageUrl?: string;
    startSecond?: number;
    durationSeconds?: number;
    position?: string;
    animation?: string;
    customText?: string;
  };
}
