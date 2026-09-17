import { IsMongoId } from 'class-validator';

export class AdminEnrollDto {
  @IsMongoId()
  studentId: string;

  @IsMongoId()
  courseId: string;
}
