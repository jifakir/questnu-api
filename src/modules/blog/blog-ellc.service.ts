import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateEllcDto } from './dto/ellc.dto';
import { BlogAuthor } from './blog-author.schema';
import {
  BlogPartner,
  BlogPartnerDocument,
  ELLC_SLUG,
} from './blog-partner.schema';
import { BlogRevalidatorService } from './blog-revalidator.service';

/** ELLC as the public site sees it. */
export type PublicEllc = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  subjects: string[];
  faqs: { question: string; answer: string }[];
  logo: string | null;
  facebookPageUrl: string | null;
  facebookGroupUrl: string | null;
  youtubeUrl: string | null;
  websiteUrl: string | null;
  showOnHomepage: boolean;
};

const DEFAULTS = {
  slug: ELLC_SLUG,
  name: 'ELLC',
  tagline: 'Courses for every NU English Department subject',
};

const OPTIONAL_LINKS = [
  'facebookPageUrl',
  'facebookGroupUrl',
  'youtubeUrl',
  'websiteUrl',
] as const;

/** The single ELLC partner profile. Created with defaults the first time it is read. */
@Injectable()
export class BlogEllcService {
  constructor(
    @InjectModel(BlogPartner.name) private readonly model: Model<BlogPartner>,
    @InjectModel(BlogAuthor.name) private readonly authors: Model<BlogAuthor>,
    private readonly revalidator: BlogRevalidatorService,
  ) {}

  async get(): Promise<BlogPartnerDocument> {
    return (
      (await this.model.findOne({ slug: ELLC_SLUG })) ??
      (await this.model.findOneAndUpdate(
        { slug: ELLC_SLUG },
        { $setOnInsert: DEFAULTS },
        { upsert: true, new: true },
      ))
    );
  }

  async id(): Promise<Types.ObjectId> {
    return (await this.get())._id;
  }

  async getAdmin() {
    return this.toAdminJson(await this.get());
  }

  async update(dto: UpdateEllcDto) {
    const doc = await this.get();
    if (dto.name !== undefined) doc.name = dto.name.trim();
    if (dto.tagline !== undefined) doc.tagline = dto.tagline.trim();
    if (dto.description !== undefined) doc.description = dto.description.trim();
    if (dto.subjects !== undefined) {
      doc.subjects = dto.subjects.map((s) => s.trim()).filter(Boolean);
    }
    if (dto.faqs !== undefined) {
      doc.faqs = dto.faqs.map((f) => ({
        question: f.question.trim(),
        answer: f.answer.trim(),
      }));
    }
    if (dto.logo !== undefined) doc.logo = dto.logo || undefined;
    for (const key of OPTIONAL_LINKS) {
      if (dto[key] !== undefined) doc[key] = dto[key]?.trim() || undefined;
    }
    if (dto.showOnHomepage !== undefined) {
      doc.showOnHomepage = dto.showOnHomepage;
    }
    await doc.save();
    this.revalidator.trigger();
    return this.toAdminJson(doc);
  }

  toPublic(doc: BlogPartnerDocument | null | undefined): PublicEllc | null {
    if (!doc?.slug) return null;
    return {
      slug: doc.slug,
      name: doc.name,
      tagline: doc.tagline,
      description: doc.description ?? '',
      subjects: doc.subjects ?? [],
      faqs: (doc.faqs ?? []).map((f) => ({
        question: f.question,
        answer: f.answer,
      })),
      logo: doc.logo ?? null,
      facebookPageUrl: doc.facebookPageUrl ?? null,
      facebookGroupUrl: doc.facebookGroupUrl ?? null,
      youtubeUrl: doc.youtubeUrl ?? null,
      websiteUrl: doc.websiteUrl ?? null,
      showOnHomepage: doc.showOnHomepage !== false,
    };
  }

  private async toAdminJson(doc: BlogPartnerDocument) {
    return {
      ...this.toPublic(doc)!,
      writerCount: await this.authors.countDocuments({ partner: doc._id }),
      updatedAt: doc.updatedAt?.toISOString() ?? null,
    };
  }
}
