import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { User } from '../../../users/user.schema';

export enum PaperStatus {
  Processing = 'processing',
  PendingReview = 'pending_review',
  AiFailed = 'ai_failed',
  Approved = 'approved',
}

export type PaperDocument = HydratedDocument<Paper>;

@Schema({ timestamps: true, collection: 'exam_papers' })
export class Paper {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  studentId: Types.ObjectId;

  /** Optional link into the LMS — kept loose per the architecture doc. */
  @Prop({ type: Types.ObjectId, ref: 'Course', index: true })
  courseId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule' })
  moduleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', index: true })
  lessonId?: Types.ObjectId;

  @Prop({ type: [String], required: true })
  imagePaths: string[];

  @Prop({ type: [String], required: true })
  imageMimeTypes: string[];

  @Prop({ type: String, enum: PaperStatus, required: true })
  status: PaperStatus;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  geminiResponse?: unknown;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  instructorFeedback?: unknown;

  @Prop({ type: Types.ObjectId, ref: User.name })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  /** Legacy free-form labels (kept for backwards compatibility w/ mobile). */
  @Prop({ type: String, trim: true })
  assignmentKey?: string;

  @Prop({ type: String, trim: true })
  courseTitle?: string;

  @Prop({ type: String, trim: true })
  examTitle?: string;
}

export const PaperSchema = SchemaFactory.createForClass(Paper);
