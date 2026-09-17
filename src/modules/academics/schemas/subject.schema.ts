import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AcademicDraftStatus } from '../academic.constants';

export type SubjectDocument = HydratedDocument<Subject>;

@Schema({ _id: false })
export class SubjectOutcome {
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ type: [String], default: [] })
  mappedPlos: string[];
}

@Schema({ _id: false })
export class SubjectOutlineUnit {
  @Prop({ required: true, trim: true })
  unit: string;

  @Prop({ required: true, trim: true })
  topic: string;

  @Prop({ type: Number, default: null })
  hours: number | null;

  @Prop({ type: [String], default: [] })
  teachingStrategies: string[];

  @Prop({ type: [String], default: [] })
  clos: string[];
}

const OutcomeSchema = SchemaFactory.createForClass(SubjectOutcome);
const OutlineSchema = SchemaFactory.createForClass(SubjectOutlineUnit);

@Schema({ timestamps: true, collection: 'academic_subjects' })
export class Subject {
  /** Published catalog id, e.g. `accounting-212501`. */
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ required: true, trim: true, lowercase: true })
  departmentId: string;

  @Prop({ required: true, trim: true })
  yearId: string;

  @Prop({ required: true, trim: true })
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

  /** Shown in the app as Introduction. Often the first objective when JSON description is empty. */
  @Prop({ trim: true, default: '' })
  introduction: string;

  @Prop({ type: [String], default: [] })
  objectives: string[];

  @Prop({ type: [OutcomeSchema], default: [] })
  outcomes: SubjectOutcome[];

  @Prop({ type: [String], default: [] })
  prescribedTexts: string[];

  @Prop({ type: [OutlineSchema], default: [] })
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

export const SubjectSchema = SchemaFactory.createForClass(Subject);
SubjectSchema.index({ departmentId: 1, yearId: 1, code: 1 });
SubjectSchema.index({ status: 1, updatedAt: -1 });
