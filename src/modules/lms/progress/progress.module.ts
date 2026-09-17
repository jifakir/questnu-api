import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LessonProgress,
  LessonProgressSchema,
} from './lesson-progress.schema';
import { Lesson, LessonSchema } from '../lessons/lesson.schema';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LessonProgress.name, schema: LessonProgressSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
    EnrollmentsModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService, MongooseModule],
})
export class ProgressModule {}
