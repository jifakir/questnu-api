import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(3_500_000)
  avatarBase64?: string;

  @ValidateIf((o: RegisterDto) => !!o.avatarBase64)
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  avatarMime?: 'image/jpeg' | 'image/png' | 'image/webp';

  @IsOptional()
  @ValidateIf((o: RegisterDto) => !!(o.whatsappNumber && o.whatsappNumber.trim()))
  @IsString()
  @MaxLength(32)
  @Matches(/^[\d+\s().-]+$/, {
    message: 'WhatsApp number may only contain digits, spaces, +, (, ), ., and -',
  })
  whatsappNumber?: string;
}
