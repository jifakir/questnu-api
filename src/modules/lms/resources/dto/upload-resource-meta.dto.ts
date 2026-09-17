import { IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadResourceMetaDto {
  @IsMongoId()
  courseId: string;

  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @IsOptional()
  @IsMongoId()
  lessonId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
