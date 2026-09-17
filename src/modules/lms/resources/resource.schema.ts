import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ResourceDocument = HydratedDocument<Resource>;

export enum ResourceKind {
  Link = 'link',
  File = 'file',
  Note = 'note',
}

@Schema({ timestamps: true, collection: 'lms_resources' })
export class Resource {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', index: true })
  moduleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', index: true })
  lessonId?: Types.ObjectId;

  @Prop({ type: String, enum: ResourceKind, required: true })
  kind: ResourceKind;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  /** External URL when kind = 'link'. */
  @Prop({ trim: true })
  url?: string;

  /** Markdown note body when kind = 'note'. */
  @Prop({ trim: true, default: '' })
  body: string;

  /** Relative path under UPLOAD_DIR/resources when kind = 'file'. */
  @Prop({ trim: true })
  fileRel?: string;

  @Prop({ trim: true })
  fileMimeType?: string;

  @Prop({ trim: true })
  fileOriginalName?: string;

  @Prop({ type: Number, min: 0 })
  fileSizeBytes?: number;

  @Prop({ type: Number, default: 0 })
  order: number;
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);

ResourceSchema.index({ courseId: 1, lessonId: 1, order: 1 });
ResourceSchema.index({ moduleId: 1, order: 1 });
