import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  /** Publish (and push) right away instead of saving a draft. */
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
