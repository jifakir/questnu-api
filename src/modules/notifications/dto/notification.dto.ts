import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NotificationCategory } from '../notification.schema';

export class CreateNotificationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  titleBn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bodyBn?: string;

  /** "general" (default) or "nu" for important National University notices. */
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  /** Years this is for, e.g. ["2"]. Empty or missing means every year. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  targetYears?: string[];

  /** Department slugs this is for. Empty or missing means every department. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  targetDepartments?: string[];

  /** Publish (and push) right away instead of saving a draft. */
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

/** Fields to change. An empty Bangla field clears it. */
export class UpdateNotificationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  titleBn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bodyBn?: string;

  /** "general" (default) or "nu" for important National University notices. */
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  /** Years this is for, e.g. ["2"]. Empty or missing means every year. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  targetYears?: string[];

  /** Department slugs this is for. Empty or missing means every department. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  targetDepartments?: string[];
}
