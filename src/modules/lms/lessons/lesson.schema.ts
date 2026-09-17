import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LessonDocument = HydratedDocument<Lesson>;

export enum LessonKind {
  LiveClass = 'live_class',
  VideoClass = 'video_class',
  Exam = 'exam',
}

@Schema({ timestamps: true, collection: 'lms_lessons' })
export class Lesson {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'CourseModule',
    required: true,
    index: true,
  })
  moduleId: Types.ObjectId;

  @Prop({ type: String, enum: LessonKind, required: true })
  kind: LessonKind;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: Number, default: 0, index: true })
  order: number;

  // ---------- live_class ----------
  @Prop({ type: Date })
  scheduledAt?: Date;

  /** Live or video duration in minutes. */
  @Prop({ type: Number, min: 0 })
  durationMinutes?: number;

  @Prop({ trim: true })
  meetingUrl?: string;

  /** zoom | meet | teams | other (free-form). */
  @Prop({ trim: true })
  meetingProvider?: string;

  /** Markdown notes shown before a live class. */
  @Prop({ trim: true, default: '' })
  studentPreparation: string;

  // ---------- video_class ----------
  @Prop({ trim: true })
  videoUrl?: string;

  @Prop({ trim: true })
  videoThumbnailUrl?: string;

  @Prop({ type: Number, min: 0 })
  videoDurationSeconds?: number;

  // ---------- exam ----------
  @Prop({ trim: true, default: '' })
  examInstructions: string;

  @Prop({ type: Number, min: 0 })
  examDurationMinutes?: number;

  @Prop({ type: Date })
  examDueAt?: Date;

  /** When true, the exam can be uploaded into the AI Exam Evaluation pipeline. */
  @Prop({ type: Boolean, default: false })
  examAiEvaluation: boolean;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);

LessonSchema.index({ courseId: 1, moduleId: 1, order: 1 });
