import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { HydratedDocument } from 'mongoose';
import { AcademicDraftStatus } from '../academic.constants';
import {
  SubjectOutlineUnit,
  SubjectOutcome,
} from './subject.schema';

export type CourseDocument = HydratedDocument<Course>;

/** One syllabus, shared by every department that offers this course code. */
@Schema({ timestamps: true, collection: 'academic_courses' })
export class Course {
  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  titleBn: string;

  @Prop({ type: Number, default: 100 })
  marks: number;

  @Prop({ type: Number, default: 0 })
  credits: number;

  @Prop({ type: Number, default: null })
  classHours: number | null;

  @Prop({ trim: true, default: '' })
  examDuration: string;

  @Prop({ trim: true, default: '' })
  orientation: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ trim: true, default: '' })
  introduction: string;

  @Prop({ type: [String], default: [] })
  objectives: string[];

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  outcomes: SubjectOutcome[];

  @Prop({ type: [String], default: [] })
  prescribedTexts: string[];

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  outline: SubjectOutlineUnit[];

  @Prop({ trim: true, default: '' })
  labDetails: string;

  @Prop({ type: [String], default: [] })
  books: string[];

  @Prop({
    type: String,
    enum: AcademicDraftStatus,
    default: AcademicDraftStatus.Draft,
  })
  status: AcademicDraftStatus;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
CourseSchema.index({ title: 1 });
