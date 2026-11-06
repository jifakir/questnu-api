import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BlogAuthorDocument = HydratedDocument<BlogAuthor>;

/** A reusable writer profile that posts point to. Written in English and shown the same on every locale. */
@Schema({ timestamps: true, collection: 'blog_authors' })
export class BlogAuthor {
  @Prop({ required: true, trim: true }) name: string;
  /** e.g. "English Instructor" */
  @Prop({ trim: true }) designation?: string;
  @Prop({ trim: true }) bio?: string;
  /** File name under UPLOAD_DIR/blog, served at GET /api/blog/images/:file. */
  @Prop({ trim: true }) avatar?: string;
  /** Organisation the author writes for (e.g. ELLC). */
  @Prop({ type: Types.ObjectId, ref: 'BlogPartner', index: true })
  partner?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BlogAuthorSchema = SchemaFactory.createForClass(BlogAuthor);
