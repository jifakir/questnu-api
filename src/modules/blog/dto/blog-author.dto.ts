import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BLOG_IMAGE_FILE } from './blog-post.dto';

export class CreateBlogAuthorDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(120) designation?: string;
  @IsOptional() @IsString() @MaxLength(600) bio?: string;

  /** Uploaded image file name from POST /admin/blog/images. Null clears it. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(BLOG_IMAGE_FILE)
  avatar?: string | null;

  /** True when the author writes for ELLC (gets the ELLC badge and card). */
  @IsOptional() @IsBoolean() ellc?: boolean;
}

export class UpdateBlogAuthorDto extends PartialType(CreateBlogAuthorDto) {}
