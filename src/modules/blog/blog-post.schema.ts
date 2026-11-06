import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum BlogPostStatus {
  Draft = 'draft',
  Published = 'published',
}

export const BLOG_LOCALES = ['bn', 'en'] as const;
export type BlogLocale = (typeof BLOG_LOCALES)[number];

/** One language version of a post. Body is Markdown. */
@Schema({ _id: false })
export class BlogLocaleContent {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ required: true, trim: true }) excerpt: string;
  /** SEO meta description. */
  @Prop({ required: true, trim: true }) description: string;
  @Prop({ trim: true, default: '' }) category: string;
  @Prop({ type: [String], default: [] }) keywords: string[];
  @Prop({ required: true }) body: string;
}
export const BlogLocaleContentSchema =
  SchemaFactory.createForClass(BlogLocaleContent);

export type BlogPostDocument = HydratedDocument<BlogPost>;

@Schema({ timestamps: true, collection: 'blog_posts' })
export class BlogPost {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({
    type: String,
    enum: BlogPostStatus,
    default: BlogPostStatus.Draft,
    index: true,
  })
  status: BlogPostStatus;

  @Prop({ type: Date, index: true }) publishedAt?: Date;

  /** File name under UPLOAD_DIR/blog, served at GET /api/blog/images/:file. */
  @Prop({ trim: true }) coverImage?: string;

  /** Bangla is required; English is optional. */
  @Prop({ type: BlogLocaleContentSchema, required: true })
  bn: BlogLocaleContent;

  @Prop({ type: BlogLocaleContentSchema }) en?: BlogLocaleContent;

  /** Byline. Unset means the site shows "QuestNU Academic Team". */
  @Prop({ type: Types.ObjectId, ref: 'BlogAuthor', index: true })
  author?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BlogPostSchema = SchemaFactory.createForClass(BlogPost);
BlogPostSchema.index({ status: 1, publishedAt: -1 });
