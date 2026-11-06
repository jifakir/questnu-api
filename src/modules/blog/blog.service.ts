import { randomBytes } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat, writeFile } from 'fs/promises';
import * as path from 'path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  BLOG_IMAGE_FILE,
  BLOG_SLUG,
  BlogLocaleContentDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from './dto/blog-post.dto';
import {
  BlogLocale,
  BlogLocaleContent,
  BlogPost,
  BlogPostDocument,
  BlogPostStatus,
} from './blog-post.schema';
import { BlogRevalidatorService } from './blog-revalidator.service';
import { BlogAuthorDocument } from './blog-author.schema';
import { BlogAuthorsService } from './blog-authors.service';
import { BlogAuthor } from './blog-author.schema';
import { BlogEllcService } from './blog-ellc.service';

/** SVG is left out on purpose: it can carry scripts. */
const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const IMAGE_TYPE_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const AUTHOR_WITH_PARTNER = { path: 'author', populate: { path: 'partner' } };

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(BlogPost.name) private readonly model: Model<BlogPost>,
    private readonly config: ConfigService,
    private readonly revalidator: BlogRevalidatorService,
    private readonly authors: BlogAuthorsService,
    private readonly ellc: BlogEllcService,
    @InjectModel(BlogAuthor.name)
    private readonly authorModel: Model<BlogAuthor>,
  ) {}

  // --- public ---

  async listPublished(locale: BlogLocale, limit = 100) {
    const filter: Record<string, unknown> = {
      status: BlogPostStatus.Published,
    };
    if (locale === 'en') filter['en.title'] = { $exists: true };
    const rows = await this.model
      .find(filter)
      .sort({ publishedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .populate(AUTHOR_WITH_PARTNER);
    return rows.map((p) => this.toPublicJson(p, locale, false));
  }

  async getPublished(slug: string, locale: BlogLocale) {
    const doc = await this.model
      .findOne({
        slug: slug.toLowerCase(),
        status: BlogPostStatus.Published,
      })
      .populate(AUTHOR_WITH_PARTNER);
    if (!doc || (locale === 'en' && !doc.en?.title)) {
      throw new NotFoundException('Post not found');
    }
    return this.toPublicJson(doc, locale, true);
  }

  /** ELLC hub: the profile, its writers and their published posts in this locale. */
  async getEllcPage(locale: BlogLocale) {
    const partner = await this.ellc.get();
    const authors = await this.authorModel
      .find({ partner: partner._id })
      .sort({ name: 1 })
      .populate('partner');
    const filter: Record<string, unknown> = {
      status: BlogPostStatus.Published,
      author: { $in: authors.map((a) => a._id) },
    };
    if (locale === 'en') filter['en.title'] = { $exists: true };
    const posts = await this.model
      .find(filter)
      .sort({ publishedAt: -1 })
      .limit(100)
      .populate(AUTHOR_WITH_PARTNER);
    return {
      partner: this.ellc.toPublic(partner),
      authors: authors.map((a) => this.authors.toPublic(a)),
      posts: posts.map((p) => this.toPublicJson(p, locale, false)),
    };
  }

  async openImage(file: string) {
    const type = IMAGE_TYPE_BY_EXT[path.extname(file).toLowerCase()];
    if (!type || !BLOG_IMAGE_FILE.test(file) || file.includes('..')) {
      throw new NotFoundException('Image not found');
    }
    const full = path.join(this.imageDir(), file);
    try {
      await stat(full);
    } catch {
      throw new NotFoundException('Image not found');
    }
    return { stream: createReadStream(full), type };
  }

  // --- admin ---

  async listAll() {
    const rows = await this.model.find().sort({ updatedAt: -1 }).limit(500);
    return rows.map((p) => this.toAdminJson(p));
  }

  async getById(id: string) {
    return this.toAdminJson(await this.findOrThrow(id));
  }

  async create(dto: CreateBlogPostDto, userId?: string) {
    const slug = dto.slug ?? this.slugFromTitle(dto.en?.title);
    const publish = dto.publish === true;
    const author = dto.authorId
      ? await this.authors.assertExists(dto.authorId)
      : undefined;
    let doc: BlogPostDocument;
    try {
      doc = await this.model.create({
        slug,
        bn: this.cleanContent(dto.bn),
        en: dto.en ? this.cleanContent(dto.en) : undefined,
        coverImage: dto.coverImage || undefined,
        author,
        status: publish ? BlogPostStatus.Published : BlogPostStatus.Draft,
        publishedAt: publish ? new Date() : undefined,
        createdBy:
          userId && isValidObjectId(userId)
            ? new Types.ObjectId(userId)
            : undefined,
      });
    } catch (e) {
      throw this.mapDuplicate(e);
    }
    this.revalidator.trigger();
    return this.toAdminJson(doc);
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    const doc = await this.findOrThrow(id);
    if (dto.slug !== undefined) doc.slug = dto.slug;
    if (dto.bn) doc.bn = this.cleanContent(dto.bn);
    if (dto.en === null) doc.en = undefined;
    else if (dto.en) doc.en = this.cleanContent(dto.en);
    if (dto.coverImage !== undefined) {
      doc.coverImage = dto.coverImage || undefined;
    }
    if (dto.authorId !== undefined) {
      doc.author = dto.authorId
        ? await this.authors.assertExists(dto.authorId)
        : undefined;
    }
    if (dto.publish === true) this.markPublished(doc);
    try {
      await doc.save();
    } catch (e) {
      throw this.mapDuplicate(e);
    }
    this.revalidator.trigger();
    return this.toAdminJson(doc);
  }

  async publish(id: string) {
    const doc = await this.findOrThrow(id);
    this.markPublished(doc);
    await doc.save();
    this.revalidator.trigger();
    return this.toAdminJson(doc);
  }

  async unpublish(id: string) {
    const doc = await this.findOrThrow(id);
    doc.status = BlogPostStatus.Draft;
    await doc.save();
    this.revalidator.trigger();
    return this.toAdminJson(doc);
  }

  async remove(id: string) {
    const doc = await this.findOrThrow(id);
    await doc.deleteOne();
    this.revalidator.trigger();
    return { ok: true };
  }

  async saveImage(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose an image to upload');
    const ext = IMAGE_EXT_BY_TYPE[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Image must be JPEG, PNG, WebP or GIF');
    }
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    await mkdir(this.imageDir(), { recursive: true });
    await writeFile(path.join(this.imageDir(), name), file.buffer);
    return { file: name, path: `/blog/images/${name}` };
  }

  // --- helpers ---

  private markPublished(doc: BlogPostDocument) {
    doc.status = BlogPostStatus.Published;
    doc.publishedAt = doc.publishedAt ?? new Date();
  }

  private imageDir() {
    return path.join(
      process.cwd(),
      this.config.get<string>('UPLOAD_DIR') ?? 'uploads',
      'blog',
    );
  }

  private slugFromTitle(title?: string) {
    const slug = (title ?? '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 100)
      .replace(/^-+|-+$/g, '');
    if (!slug || !BLOG_SLUG.test(slug)) {
      throw new BadRequestException(
        'Slug is required (add one, or an English title to generate it from)',
      );
    }
    return slug;
  }

  private cleanContent(c: BlogLocaleContentDto): BlogLocaleContent {
    return {
      title: c.title.trim(),
      excerpt: c.excerpt.trim(),
      description: c.description.trim(),
      category: c.category?.trim() ?? '',
      keywords: (c.keywords ?? []).map((k) => k.trim()).filter(Boolean),
      body: c.body,
    };
  }

  private mapDuplicate(e: unknown) {
    if ((e as { code?: number })?.code === 11000) {
      return new ConflictException('A post with this slug already exists');
    }
    return e;
  }

  private async findOrThrow(id: string) {
    const doc = isValidObjectId(id) ? await this.model.findById(id) : null;
    if (!doc) throw new NotFoundException('Post not found');
    return doc;
  }

  private readingMinutes(body: string) {
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  private locales(doc: BlogPostDocument): BlogLocale[] {
    return doc.en?.title ? ['bn', 'en'] : ['bn'];
  }

  private toPublicJson(
    doc: BlogPostDocument,
    locale: BlogLocale,
    withBody: boolean,
  ) {
    const c = locale === 'en' && doc.en?.title ? doc.en : doc.bn;
    return {
      slug: doc.slug,
      title: c.title,
      excerpt: c.excerpt,
      description: c.description,
      category: c.category,
      keywords: c.keywords,
      coverImage: doc.coverImage ?? null,
      publishedAt: (doc.publishedAt ?? doc.createdAt)?.toISOString() ?? null,
      updatedAt: doc.updatedAt?.toISOString() ?? null,
      readingMinutes: this.readingMinutes(c.body),
      locales: this.locales(doc),
      // Populated by the public queries above.
      author: this.authors.toPublic(
        doc.author as unknown as BlogAuthorDocument | undefined,
      ),
      ...(withBody ? { body: c.body } : {}),
    };
  }

  private toAdminJson(doc: BlogPostDocument) {
    const content = (c?: BlogLocaleContent) =>
      c?.title
        ? {
            title: c.title,
            excerpt: c.excerpt,
            description: c.description,
            category: c.category,
            keywords: c.keywords,
            body: c.body,
          }
        : null;
    return {
      id: doc.id,
      slug: doc.slug,
      status: doc.status,
      publishedAt: doc.publishedAt?.toISOString() ?? null,
      coverImage: doc.coverImage ?? null,
      authorId: doc.author ? String(doc.author) : null,
      bn: content(doc.bn),
      en: content(doc.en),
      createdAt: doc.createdAt?.toISOString() ?? null,
      updatedAt: doc.updatedAt?.toISOString() ?? null,
    };
  }
}
