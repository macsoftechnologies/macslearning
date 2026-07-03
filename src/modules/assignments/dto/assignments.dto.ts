import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssignmentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  dueDate: Date;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  totalMarks: number;

  @IsString()
  @IsOptional()
  fileUrl?: string;
}

export class GradeSubmissionDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  marksObtained: number;

  @IsString()
  @IsOptional()
  feedback?: string;

  @IsEnum(['GRADED', 'REJECTED'])
  @IsOptional()
  status?: string;
}
