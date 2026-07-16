import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (default: 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page (default: 10, max: 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term for filtering results' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : value,
  )
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by userType' })
  @IsOptional()
  @IsString()
  userType?: string;
}
