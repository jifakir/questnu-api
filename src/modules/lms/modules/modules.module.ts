import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleSchema,
} from './course-module.schema';
import { Lesson, LessonSchema } from '../lessons/lesson.schema';
import { Resource, ResourceSchema } from '../resources/resource.schema';
import {
  LessonProgress,
  LessonProgressSchema,
} from '../progress/lesson-progress.schema';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseModuleEntity.name, schema: CourseModuleSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Resource.name, schema: ResourceSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
    ]),
    CoursesModule,
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService, MongooseModule],
})
export class ModulesModule {}
