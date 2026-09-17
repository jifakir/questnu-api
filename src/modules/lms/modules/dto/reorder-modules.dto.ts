import { ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

export class ReorderModulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  moduleIds: string[];
}
