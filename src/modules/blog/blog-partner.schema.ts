import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** The only partner. Its document is created on first use with this slug. */
export const ELLC_SLUG = 'ellc';

@Schema({ _id: false })
export class PartnerFaq {
  @Prop({ required: true, trim: true }) question: string;
  @Prop({ required: true, trim: true }) answer: string;
}
export const PartnerFaqSchema = SchemaFactory.createForClass(PartnerFaq);

export type BlogPartnerDocument = HydratedDocument<BlogPartner>;

/**
 * ELLC, QuestNU's partner for NU English Department subjects. Authors marked
 * as ELLC writers get the ELLC badge and card on their posts, and the site's
 * /english-department hub is built from this profile.
 */
@Schema({ timestamps: true, collection: 'blog_partners' })
export class BlogPartner {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ required: true, trim: true }) name: string;
  /** One line for badges and the end-of-post card. */
  @Prop({ required: true, trim: true }) tagline: string;
  /** Longer text for the hub page. Blank lines separate paragraphs. */
  @Prop({ trim: true, default: '' }) description: string;
  /** NU English Department subjects ELLC covers. */
  @Prop({ type: [String], default: [] }) subjects: string[];
  /** Shown on the hub page and as FAQ rich results in Google. */
  @Prop({ type: [PartnerFaqSchema], default: [] }) faqs: PartnerFaq[];
  /** File name under UPLOAD_DIR/blog, served at GET /api/blog/images/:file. */
  @Prop({ trim: true }) logo?: string;
  @Prop({ trim: true }) facebookPageUrl?: string;
  @Prop({ trim: true }) facebookGroupUrl?: string;
  @Prop({ trim: true }) youtubeUrl?: string;
  @Prop({ trim: true }) websiteUrl?: string;
  /** Show the ELLC section on the homepage. */
  @Prop({ default: true }) showOnHomepage: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BlogPartnerSchema = SchemaFactory.createForClass(BlogPartner);
