import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  mobile?: string;
}

export class RejectStudentDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}
