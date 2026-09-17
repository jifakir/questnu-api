import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LessonProgressDocument = HydratedDocument<LessonProgress>;

export enum LessonProgressStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
}

@Schema({ timestamps: true, collection: 'lms_lesson_progress' })
export class LessonProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true, index: true })
  lessonId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true })
  moduleId: Types.ObjectId;

  @Prop({
    type: String,
    enum: LessonProgressStatus,
    default: LessonProgressStatus.NotStarted,
  })
  status: LessonProgressStatus;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;
}

export const LessonProgressSchema = SchemaFactory.createForClass(LessonProgress);

LessonProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });
LessonProgressSchema.index({ studentId: 1, courseId: 1 });
