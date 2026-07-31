import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CheckpointOptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateLessonCheckpointDto {
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @IsNumber()
  @IsNotEmpty()
  timestampSeconds: number;

  @IsEnum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'])
  type: string;

  @ValidateNested({ each: true })
  @Type(() => CheckpointOptionDto)
  @IsOptional()
  options?: CheckpointOptionDto[];

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

export class AnswerCheckpointDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsOptional()
  selectedOption?: string;

  @IsString()
  @IsOptional()
  textAnswer?: string;
}
