import { IsEnum } from 'class-validator';
import { LessonProgressStatus } from '../lesson-progress.schema';

export class SetProgressDto {
  @IsEnum(LessonProgressStatus)
  status: LessonProgressStatus;
}
