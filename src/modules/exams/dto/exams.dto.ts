import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  durationMinutes: number;

  @IsNumber()
  @IsNotEmpty()
  passingPercentage: number;

  @IsNumber()
  @IsNotEmpty()
  totalMarks: number;

  @IsNumber()
  @Min(1)
  @Max(3)
  @IsOptional()
  maxAttempts?: number;

  @IsBoolean()
  @IsOptional()
  isFinalExam?: boolean;
}

export class OptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class QuestionDto {
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @IsEnum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'])
  type: string;

  @IsNumber()
  @IsNotEmpty()
  marks: number;

  @IsNumber()
  @IsOptional()
  orderIndex?: number;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  @IsOptional()
  options?: OptionDto[];

  @IsString()
  @IsOptional()
  correctAnswer?: string;
}

export class UpdateQuestionDto extends QuestionDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SaveAnswerDto {
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

export class AnswerItemDto {
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

export class SubmitAttemptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}

export class GradeShortAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsNumber()
  @IsNotEmpty()
  marks: number;
}
