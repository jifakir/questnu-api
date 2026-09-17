import { Module } from '@nestjs/common';
import { CoursesModule } from './courses/courses.module';
import { ModulesModule } from './modules/modules.module';
import { LessonsModule } from './lessons/lessons.module';
import { ResourcesModule } from './resources/resources.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { ProgressModule } from './progress/progress.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    CoursesModule,
    ModulesModule,
    LessonsModule,
    ResourcesModule,
    EnrollmentsModule,
    ProgressModule,
    CatalogModule,
  ],
})
export class LmsModule {}
