import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CourseLinkDocument = HydratedDocument<CourseLink>;

/** Department offering of a shared course. Course code is the link key. */
@Schema({ timestamps: true, collection: 'academic_course_links' })
export class CourseLink {
  @Prop({ required: true, trim: true })
  courseCode: string;

  @Prop({ required: true, trim: true, lowercase: true })
  departmentId: string;

  @Prop({ required: true, trim: true })
  yearId: string;

  /** Existing subject slugs, so question banks and the app keep their ids. */
  @Prop({ type: [String], default: [] })
  subjectSlugs: string[];
}

export const CourseLinkSchema = SchemaFactory.createForClass(CourseLink);
CourseLinkSchema.index(
  { courseCode: 1, departmentId: 1, yearId: 1 },
  { unique: true },
);
CourseLinkSchema.index({ departmentId: 1, yearId: 1 });
CourseLinkSchema.index({ subjectSlugs: 1 });
