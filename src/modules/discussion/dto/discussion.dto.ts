import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class AddReplyDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
