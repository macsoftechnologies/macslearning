import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CompleteLessonDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  moduleId: string;
}

export class UpdateWatchTimeDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @IsNumber()
  @IsNotEmpty()
  watchedSeconds: number;
}
