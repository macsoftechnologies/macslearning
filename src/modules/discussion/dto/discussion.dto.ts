import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  lessonId?: string;
}

export class AddReplyDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
