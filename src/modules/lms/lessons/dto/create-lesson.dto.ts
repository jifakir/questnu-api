import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LessonKind } from '../lesson.schema';

export class CreateLessonDto {
  @IsEnum(LessonKind)
  kind: LessonKind;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;

  // live_class
  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.LiveClass)
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ValidateIf(
    (o: CreateLessonDto) =>
      o.kind === LessonKind.LiveClass || o.kind === LessonKind.VideoClass,
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  durationMinutes?: number;

  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.LiveClass)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  meetingUrl?: string;

  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.LiveClass)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  meetingProvider?: string;

  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.LiveClass)
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  studentPreparation?: string;

  // video_class
  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.VideoClass)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.VideoClass)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoThumbnailUrl?: string;

  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.VideoClass)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60 * 60)
  videoDurationSeconds?: number;

  // exam
  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.Exam)
  @IsOptional()
  @IsString()
  @MaxLength(16000)
  examInstructions?: string;

  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.Exam)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  examDurationMinutes?: number;

  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.Exam)
  @IsOptional()
  @IsDateString()
  examDueAt?: string;

  @ValidateIf((o: CreateLessonDto) => o.kind === LessonKind.Exam)
  @IsOptional()
  @IsBoolean()
  examAiEvaluation?: boolean;
}
