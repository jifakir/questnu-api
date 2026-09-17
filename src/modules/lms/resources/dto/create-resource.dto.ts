import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ResourceKind } from '../resource.schema';

export class CreateResourceDto {
  @IsMongoId()
  courseId: string;

  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @IsOptional()
  @IsMongoId()
  lessonId?: string;

  @IsEnum(ResourceKind)
  kind: ResourceKind;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ValidateIf((o: CreateResourceDto) => o.kind === ResourceKind.Link)
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ValidateIf((o: CreateResourceDto) => o.kind === ResourceKind.Note)
  @IsString()
  @MaxLength(32000)
  body?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  order?: number;
}
