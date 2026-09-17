import { IsBoolean, IsObject } from 'class-validator';

export class ReviewPaperDto {
  @IsObject()
  feedback: Record<string, unknown>;

  @IsBoolean()
  approve: boolean;
}
