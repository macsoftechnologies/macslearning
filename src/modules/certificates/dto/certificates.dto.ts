import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateCertificateDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsBoolean()
  @IsOptional()
  override?: boolean;
}

export class TemplateFieldDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsOptional()
  variable?: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  @IsOptional()
  width?: number;

  @IsNumber()
  @IsOptional()
  height?: number;

  @IsNumber()
  @IsOptional()
  fontSize?: number;

  @IsString()
  @IsOptional()
  fontFamily?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  textAlign?: string;
}

export class CreateCertificateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsEnum(['BLANK', 'IMAGE'])
  @IsOptional()
  backgroundType?: string;

  @IsString()
  @IsOptional()
  backgroundImageUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  @IsOptional()
  fields?: TemplateFieldDto[];
}

export class UpdateCertificateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsEnum(['BLANK', 'IMAGE'])
  @IsOptional()
  backgroundType?: string;

  @IsString()
  @IsOptional()
  backgroundImageUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  @IsOptional()
  fields?: TemplateFieldDto[];
}
