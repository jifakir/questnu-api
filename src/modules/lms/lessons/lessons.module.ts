import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lesson, LessonSchema } from './lesson.schema';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleSchema,
} from '../modules/course-module.schema';
import { Resource, ResourceSchema } from '../resources/resource.schema';
import {
  LessonProgress,
  LessonProgressSchema,
} from '../progress/lesson-progress.schema';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lesson.name, schema: LessonSchema },
      { name: CourseModuleEntity.name, schema: CourseModuleSchema },
      { name: Resource.name, schema: ResourceSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
    ]),
  ],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService, MongooseModule],
})
export class LessonsModule {}
