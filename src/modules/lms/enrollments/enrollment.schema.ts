import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EnrollmentDocument = HydratedDocument<Enrollment>;

export enum EnrollmentStatus {
  Active = 'active',
  Completed = 'completed',
  Dropped = 'dropped',
}

@Schema({ timestamps: true, collection: 'lms_enrollments' })
export class Enrollment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({
    type: String,
    enum: EnrollmentStatus,
    default: EnrollmentStatus.Active,
  })
  status: EnrollmentStatus;

  @Prop({ type: Date, default: () => new Date() })
  enrolledAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  /** Cached 0-100 (recomputed when progress changes). */
  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  progressPercent: number;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

EnrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
EnrollmentSchema.index({ courseId: 1, status: 1 });
