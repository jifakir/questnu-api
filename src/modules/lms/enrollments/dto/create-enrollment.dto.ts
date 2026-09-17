import { IsMongoId } from 'class-validator';

export class CreateEnrollmentDto {
  @IsMongoId()
  courseId: string;
}
