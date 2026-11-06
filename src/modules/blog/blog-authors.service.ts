import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  CreateBlogAuthorDto,
  UpdateBlogAuthorDto,
} from './dto/blog-author.dto';
import { BlogAuthor, BlogAuthorDocument } from './blog-author.schema';
import { BlogPost } from './blog-post.schema';
import { BlogRevalidatorService } from './blog-revalidator.service';
import { BlogPartnerDocument } from './blog-partner.schema';
import { BlogEllcService, PublicEllc } from './blog-ellc.service';

const TEXT_FIELDS = ['name', 'designation', 'bio'] as const;

/** Author as the public site sees it (same on every locale). */
export type PublicBlogAuthor = {
  id: string;
  name: string;
  designation: string | null;
  bio: string | null;
  avatar: string | null;
  partner: PublicEllc | null;
};

@Injectable()
export class BlogAuthorsService {
  constructor(
    @InjectModel(BlogAuthor.name) private readonly model: Model<BlogAuthor>,
    @InjectModel(BlogPost.name) private readonly posts: Model<BlogPost>,
    private readonly revalidator: BlogRevalidatorService,
    private readonly ellc: BlogEllcService,
  ) {}

  async listAll() {
    const [rows, counts] = await Promise.all([
      this.model.find().sort({ name: 1 }),
      this.posts.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { author: { $exists: true } } },
        { $group: { _id: '$author', n: { $sum: 1 } } },
      ]),
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    return rows.map((a) => this.toAdminJson(a, byId.get(a.id) ?? 0));
  }

  async create(dto: CreateBlogAuthorDto) {
    const doc = await this.model.create({
      ...this.clean(dto),
      partner: dto.ellc ? await this.ellc.id() : undefined,
    });
    return this.toAdminJson(doc, 0);
  }

  async update(id: string, dto: UpdateBlogAuthorDto) {
    const doc = await this.findOrThrow(id);
    const patch = this.clean(dto);
    for (const key of [...TEXT_FIELDS, 'avatar'] as const) {
      if (key in dto) doc.set(key, patch[key]);
    }
    if (dto.ellc !== undefined) {
      doc.partner = dto.ellc ? await this.ellc.id() : undefined;
    }
    if (!doc.name) throw new BadRequestException('Name is required');
    await doc.save();
    this.revalidator.trigger();
    return this.toAdminJson(doc, await this.postCount(doc._id));
  }

  /** Refuses while posts still use the author, so no post silently loses its byline. */
  async remove(id: string) {
    const doc = await this.findOrThrow(id);
    const used = await this.postCount(doc._id);
    if (used > 0) {
      throw new ConflictException(
        `This author is used by ${used} post${used === 1 ? '' : 's'}. Pick another author on those posts first.`,
      );
    }
    await doc.deleteOne();
    return { ok: true };
  }

  /** Returns the id as an ObjectId, or throws 400 if no such author exists. */
  async assertExists(id: string) {
    if (!isValidObjectId(id) || !(await this.model.exists({ _id: id }))) {
      throw new BadRequestException('Author not found');
    }
    return new Types.ObjectId(id);
  }

  /** Expects `partner` to be populated when the caller wants it in the output. */
  toPublic(
    author: BlogAuthorDocument | null | undefined,
  ): PublicBlogAuthor | null {
    if (!author?.name) return null;
    const partner = author.partner as unknown as
      | BlogPartnerDocument
      | Types.ObjectId
      | undefined;
    return {
      id: author.id,
      name: author.name,
      designation: author.designation || null,
      bio: author.bio || null,
      avatar: author.avatar ?? null,
      partner:
        partner && 'slug' in partner ? this.ellc.toPublic(partner) : null,
    };
  }

  private postCount(id: Types.ObjectId) {
    return this.posts.countDocuments({ author: id });
  }

  private clean(dto: UpdateBlogAuthorDto) {
    const out: Partial<
      Record<(typeof TEXT_FIELDS)[number] | 'avatar', string>
    > = {};
    for (const key of TEXT_FIELDS) {
      const v = dto[key]?.trim();
      out[key] = v || undefined;
    }
    out.avatar = dto.avatar || undefined;
    return out;
  }

  private async findOrThrow(id: string) {
    const doc = isValidObjectId(id) ? await this.model.findById(id) : null;
    if (!doc) throw new NotFoundException('Author not found');
    return doc;
  }

  private toAdminJson(doc: BlogAuthorDocument, postCount: number) {
    return {
      id: doc.id,
      name: doc.name,
      designation: doc.designation ?? null,
      bio: doc.bio ?? null,
      avatar: doc.avatar ?? null,
      ellc: !!doc.partner,
      postCount,
      createdAt: doc.createdAt?.toISOString() ?? null,
      updatedAt: doc.updatedAt?.toISOString() ?? null,
    };
  }
}
