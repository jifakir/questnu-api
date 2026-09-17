import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from './course.schema';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleSchema,
} from '../modules/course-module.schema';
import { Lesson, LessonSchema } from '../lessons/lesson.schema';
import { Resource, ResourceSchema } from '../resources/resource.schema';
import { Enrollment, EnrollmentSchema } from '../enrollments/enrollment.schema';
import {
  LessonProgress,
  LessonProgressSchema,
} from '../progress/lesson-progress.schema';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: CourseModuleEntity.name, schema: CourseModuleSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Resource.name, schema: ResourceSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: LessonProgress.name, schema: LessonProgressSchema },
    ]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService, MongooseModule],
})
export class CoursesModule {}
