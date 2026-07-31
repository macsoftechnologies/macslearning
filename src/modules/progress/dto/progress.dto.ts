import { IsNotEmpty, IsString } from 'class-validator';

export class CompleteLessonDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  moduleId: string;
}
