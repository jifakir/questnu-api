import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseModuleDocument = HydratedDocument<CourseModule>;

@Schema({ timestamps: true, collection: 'lms_course_modules' })
export class CourseModule {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: Number, default: 0, index: true })
  order: number;
}

export const CourseModuleSchema = SchemaFactory.createForClass(CourseModule);

CourseModuleSchema.index({ courseId: 1, order: 1 });
