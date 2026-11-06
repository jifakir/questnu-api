import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const BLOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BLOG_IMAGE_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/;

export class BlogLocaleContentDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsString() @MinLength(1) @MaxLength(400) excerpt: string;
  @IsString() @MinLength(1) @MaxLength(300) description: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  keywords?: string[];

  @IsString() @MinLength(1) @MaxLength(200_000) body: string;
}

export class CreateBlogPostDto {
  /** Lowercase words joined by hyphens. Derived from the English title when left out. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(BLOG_SLUG, {
    message: 'slug must be lowercase letters and digits joined by hyphens',
  })
  slug?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => BlogLocaleContentDto)
  bn: BlogLocaleContentDto;

  /** Send null on update to remove the English version. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => BlogLocaleContentDto)
  en?: BlogLocaleContentDto | null;

  /** Uploaded image file name from POST /admin/blog/images. Null clears it. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(BLOG_IMAGE_FILE)
  coverImage?: string | null;

  /** Publish immediately (on create or update). */
  @IsOptional() @IsBoolean() publish?: boolean;
}

export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {}
