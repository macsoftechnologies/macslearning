import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateCertificateDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsBoolean()
  @IsOptional()
  override?: boolean;
}
