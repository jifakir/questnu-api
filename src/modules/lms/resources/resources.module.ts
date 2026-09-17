import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Resource, ResourceSchema } from './resource.schema';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleSchema,
} from '../modules/course-module.schema';
import { Lesson, LessonSchema } from '../lessons/lesson.schema';
import { CoursesModule } from '../courses/courses.module';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Resource.name, schema: ResourceSchema },
      { name: CourseModuleEntity.name, schema: CourseModuleSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
    CoursesModule,
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService, MongooseModule],
})
export class ResourcesModule {}
