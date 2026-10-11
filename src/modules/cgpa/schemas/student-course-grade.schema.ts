import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StudentCourseGradeDocument = HydratedDocument<StudentCourseGrade>;

@Schema({ timestamps: true, collection: 'student_course_grades' })
export class StudentCourseGrade {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  departmentId: string;

  @Prop({ required: true, trim: true })
  yearId: string;

  /** Shared catalog course code — join key to academic_courses. */
  @Prop({ required: true, trim: true })
  courseCode: string;

  /** Credits snapshotted when the grade was saved. */
  @Prop({ type: Number, required: true })
  credits: number;

  @Prop({ required: true, trim: true })
  gradeLabel: string;

  @Prop({ type: Number, required: true })
  gradePoint: number;
}

export const StudentCourseGradeSchema =
  SchemaFactory.createForClass(StudentCourseGrade);

StudentCourseGradeSchema.index(
  { studentId: 1, departmentId: 1, yearId: 1, courseCode: 1 },
  { unique: true },
);
StudentCourseGradeSchema.index({ studentId: 1, departmentId: 1, yearId: 1 });
