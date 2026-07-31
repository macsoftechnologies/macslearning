import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCheckpointAnswerDto {
  @IsString()
  @IsNotEmpty()
  checkpointId: string;

  @IsString()
  @IsOptional()
  selectedOption?: string;

  @IsString()
  @IsOptional()
  textAnswer?: string;
}

export class GradeCheckpointAnswerDto {
  @IsNotEmpty()
  marks: number;

  @IsString()
  @IsOptional()
  feedback?: string;
}
