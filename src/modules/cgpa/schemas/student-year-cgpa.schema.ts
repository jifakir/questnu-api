import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StudentYearCgpaDocument = HydratedDocument<StudentYearCgpa>;

@Schema({ timestamps: true, collection: 'student_year_cgpa' })
export class StudentYearCgpa {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  departmentId: string;

  @Prop({ required: true, trim: true })
  yearId: string;

  @Prop({ type: Number, required: true })
  cgpa: number;

  @Prop({ type: Number, required: true })
  totalCredits: number;

  @Prop({ type: Number, required: true })
  earnedPoints: number;

  @Prop({ type: Number, required: true })
  gradedCount: number;
}

export const StudentYearCgpaSchema =
  SchemaFactory.createForClass(StudentYearCgpa);

StudentYearCgpaSchema.index(
  { studentId: 1, departmentId: 1, yearId: 1 },
  { unique: true },
);
StudentYearCgpaSchema.index({ studentId: 1 });
