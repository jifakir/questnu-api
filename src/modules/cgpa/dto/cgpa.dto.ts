import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertCourseGradeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  departmentId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  yearId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  courseCode: string;

  @IsNumber()
  @Min(0)
  @Max(20)
  credits: number;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  gradeLabel: string;

  @IsNumber()
  @Min(0)
  @Max(4)
  gradePoint: number;
}

export class UpsertCourseGradesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertCourseGradeDto)
  grades: UpsertCourseGradeDto[];
}

export class DeleteCourseGradeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  departmentId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  yearId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  courseCode?: string;
}

export class UpdateTargetCgpaDto {
  @IsNumber()
  @Min(0)
  @Max(4)
  targetCgpa: number;
}
