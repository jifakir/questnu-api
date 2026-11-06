import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BLOG_IMAGE_FILE } from './blog-post.dto';

const URL_OPTS = { protocols: ['http', 'https'], require_protocol: true };

/** Empty string clears an optional link. */
const hasValue = (v: unknown) => v !== '' && v !== null && v !== undefined;

export class EllcFaqDto {
  @IsString() @MinLength(1) @MaxLength(200) question: string;
  @IsString() @MinLength(1) @MaxLength(1500) answer: string;
}

/** Every field optional: only the keys sent are changed. */
export class UpdateEllcDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) tagline?: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  subjects?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EllcFaqDto)
  faqs?: EllcFaqDto[];

  /** Uploaded image file name from POST /admin/blog/images. Null clears it. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(BLOG_IMAGE_FILE)
  logo?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => hasValue(v))
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  facebookPageUrl?: string;

  @IsOptional()
  @ValidateIf((_, v) => hasValue(v))
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  facebookGroupUrl?: string;

  @IsOptional()
  @ValidateIf((_, v) => hasValue(v))
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  youtubeUrl?: string;

  @IsOptional()
  @ValidateIf((_, v) => hasValue(v))
  @IsUrl(URL_OPTS)
  @MaxLength(300)
  websiteUrl?: string;

  @IsOptional() @IsBoolean() showOnHomepage?: boolean;
}
