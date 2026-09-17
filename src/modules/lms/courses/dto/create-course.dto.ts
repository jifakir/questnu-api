import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CourseLevel, CourseStatus } from '../course.schema';

export class CreateCourseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24000)
  learningOutcomes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  prerequisites?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  targetAudience?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  language?: string;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}
