import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class FirebaseMobileDto {
  @IsString()
  @MinLength(20)
  firebaseIdToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photoUrl?: string;
}

