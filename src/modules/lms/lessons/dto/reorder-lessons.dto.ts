import { ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

export class ReorderLessonsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  lessonIds: string[];
}
