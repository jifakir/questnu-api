import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../users/user.schema';
import { ACADEMIC_COURSE_MODEL, CourseSchema } from '../academics/schemas/course.schema';
import { CgpaController } from './cgpa.controller';
import { CgpaService } from './cgpa.service';
import {
  StudentCourseGrade,
  StudentCourseGradeSchema,
} from './schemas/student-course-grade.schema';
import {
  StudentYearCgpa,
  StudentYearCgpaSchema,
} from './schemas/student-year-cgpa.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentCourseGrade.name, schema: StudentCourseGradeSchema },
      { name: StudentYearCgpa.name, schema: StudentYearCgpaSchema },
      { name: User.name, schema: UserSchema },
      { name: ACADEMIC_COURSE_MODEL, schema: CourseSchema },
    ]),
  ],
  controllers: [CgpaController],
  providers: [CgpaService],
  exports: [CgpaService],
})
export class CgpaModule {}
