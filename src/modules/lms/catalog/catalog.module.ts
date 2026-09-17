import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from '../courses/course.schema';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleSchema,
} from '../modules/course-module.schema';
import { Lesson, LessonSchema } from '../lessons/lesson.schema';
import { Resource, ResourceSchema } from '../resources/resource.schema';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: CourseModuleEntity.name, schema: CourseModuleSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Resource.name, schema: ResourceSchema },
    ]),
    EnrollmentsModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
