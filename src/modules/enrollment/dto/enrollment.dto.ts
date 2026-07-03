import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminEnrollStudentDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsOptional()
  paymentStatus?: string;
}
