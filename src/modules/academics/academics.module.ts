import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicsController } from './academics.controller';
import { QuestionsService } from './questions.service';
import {
  AcademicYear,
  AcademicYearSchema,
} from './schemas/academic-year.schema';
import { College, CollegeSchema } from './schemas/college.schema';
import { Department, DepartmentSchema } from './schemas/department.schema';
import { Question, QuestionSchema } from './schemas/question.schema';
import { Course, CourseSchema } from './schemas/course.schema';
import { CourseLink, CourseLinkSchema } from './schemas/course-link.schema';
import { Subject, SubjectSchema } from './schemas/subject.schema';
import { CatalogSeedService } from './seed/catalog-seed.service';
import { CoursesService } from './courses.service';
import { StructureService } from './structure.service';
import { SubjectsService } from './subjects.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: College.name, schema: CollegeSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: AcademicYear.name, schema: AcademicYearSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Course.name, schema: CourseSchema },
      { name: CourseLink.name, schema: CourseLinkSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  controllers: [AcademicsController],
  providers: [StructureService, SubjectsService, QuestionsService, CoursesService, CatalogSeedService],
  exports: [StructureService, SubjectsService, QuestionsService, CoursesService, CatalogSeedService],
})
export class AcademicsModule {}
