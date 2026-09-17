import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  clearAvatar?: boolean;

  /** Send empty string to clear the stored number. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsappNumber?: string;

  /** NU college code. Send empty string to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  collegeCode?: string;

  /** Legacy free-text name. Prefer collegeCode. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  collegeName?: string;

  /** Send empty string to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  department?: string;

  /** Year the student is currently reading. Send empty string to clear. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  currentYear?: string;
}
