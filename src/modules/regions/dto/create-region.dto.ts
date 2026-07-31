import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateRegionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}
