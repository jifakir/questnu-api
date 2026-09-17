import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseDocument = HydratedDocument<Course>;

export enum CourseLevel {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
  Mixed = 'mixed',
}

export enum CourseStatus {
  Draft = 'draft',
  Published = 'published',
}

@Schema({ timestamps: true, collection: 'lms_courses' })
export class Course {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  code: string;

  @Prop({ trim: true, default: '' })
  subtitle: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ trim: true, default: '' })
  coverImageUrl: string;

  @Prop({ trim: true, default: '' })
  learningOutcomes: string;

  @Prop({ trim: true, default: '' })
  prerequisites: string;

  @Prop({ trim: true, default: '' })
  targetAudience: string;

  @Prop({ type: Number, min: 0 })
  estimatedHours?: number;

  @Prop({ trim: true, default: 'English' })
  language: string;

  @Prop({ type: String, enum: CourseLevel, default: CourseLevel.Mixed })
  level: CourseLevel;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, enum: CourseStatus, default: CourseStatus.Draft })
  status: CourseStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const CourseSchema = SchemaFactory.createForClass(Course);

CourseSchema.index({ status: 1, updatedAt: -1 });
CourseSchema.index({ createdBy: 1 });
