import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AcademicDraftStatus, QuestionType } from '../academic.constants';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ _id: false })
export class QuestionOption {
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ trim: true, default: '' })
  textBn: string;
}

const QuestionOptionSchema = SchemaFactory.createForClass(QuestionOption);

@Schema({ timestamps: true, collection: 'academic_questions' })
export class Question {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ required: true, trim: true, lowercase: true })
  subjectSlug: string;

  @Prop({ required: true, trim: true, lowercase: true })
  departmentId: string;

  @Prop({ required: true, trim: true })
  yearId: string;

  /** Outline unit this question belongs to, when known. */
  @Prop({ trim: true, default: '' })
  unit: string;

  @Prop({ type: String, enum: QuestionType, required: true })
  type: QuestionType;

  @Prop({ required: true, trim: true })
  prompt: string;

  @Prop({ trim: true, default: '' })
  promptBn: string;

  @Prop({ type: [QuestionOptionSchema], default: [] })
  options: QuestionOption[];

  @Prop({ trim: true, default: '' })
  correctOptionId: string;

  @Prop({ trim: true, default: '' })
  answer: string;

  @Prop({ type: Number, default: 1 })
  marks: number;

  /** Exam session the question was drawn from, e.g. `2024`. */
  @Prop({ trim: true, default: '' })
  session: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({
    type: String,
    enum: AcademicDraftStatus,
    default: AcademicDraftStatus.Draft,
  })
  status: AcademicDraftStatus;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index({ departmentId: 1, yearId: 1, subjectSlug: 1 });
QuestionSchema.index({ subjectSlug: 1, unit: 1 });
