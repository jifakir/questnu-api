import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

/** Optional multipart text fields sent with exam image uploads. */
export class UploadPaperBodyDto {
  /** Optional LMS linkage. */
  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @IsOptional()
  @IsMongoId()
  lessonId?: string;

  /** Free-form key used by clients that don't have a lessonId yet. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignmentKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  courseTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  examTitle?: string;
}
