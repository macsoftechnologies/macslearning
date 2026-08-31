import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CompleteLessonDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsOptional()
  moduleId?: string;
}

export class UpdateWatchTimeDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsOptional()
  moduleId?: string;

  @IsNumber()
  @IsNotEmpty()
  watchedSeconds: number;
}
