import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { FirebaseAdminService } from '../../firebase/firebase-admin.service';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
} from './dto/notification.dto';
import {
  AppNotification,
  AppNotificationDocument,
  NotificationCategory,
  NotificationStatus,
} from './notification.schema';
import {
  audienceFilter,
  audienceTopics,
  cleanIds,
  MAX_AUDIENCE_TOPICS,
} from './audience';

export { ALL_USERS_TOPIC } from './audience';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(AppNotification.name)
    private readonly model: Model<AppNotification>,
    private readonly firebase: FirebaseAdminService,
  ) {}

  /** One page of every notification (drafts too), newest first, for the admin panel. */
  async listAll(query: AdminNotificationQuery = {}) {
    const limit = clampInt(query.limit, 20, 1, 100);
    const filter: Record<string, unknown> = {};

    if (query.status) {
      if (
        query.status !== NotificationStatus.Draft &&
        query.status !== NotificationStatus.Published
      ) {
        throw new BadRequestException('status must be "draft" or "published"');
      }
      filter.status = query.status;
    }
    if (query.category === NotificationCategory.Nu) {
      filter.category = NotificationCategory.Nu;
    } else if (query.category === NotificationCategory.General) {
      filter.category = { $ne: NotificationCategory.Nu };
    } else if (query.category) {
      throw new BadRequestException('category must be "general" or "nu"');
    }
    const q = query.q?.trim();
    if (q) {
      const re = new RegExp(escapeRegex(q.slice(0, 100)), 'i');
      filter.$or = [
        { title: re },
        { body: re },
        { titleBn: re },
        { bodyBn: re },
      ];
    }

    const total = await this.model.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(clampInt(query.page, 1, 1, 100000), pages);
    const rows = await this.model
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return {
      items: rows.map((n) => this.toAdminJson(n)),
      total,
      page,
      limit,
      pages,
    };
  }

  /**
   * Newest first. [category] narrows the list; notifications saved before
   * categories existed count as general. [year] and [department] are the
   * student's own; notifications aimed at other students are left out.
   */
  async listPublished(
    limit = 50,
    category?: string,
    year?: string,
    department?: string,
  ) {
    const filter: Record<string, unknown> = {
      status: NotificationStatus.Published,
      ...audienceFilter(year, department),
    };
    if (category === NotificationCategory.Nu) {
      filter.category = NotificationCategory.Nu;
    } else if (category === NotificationCategory.General) {
      filter.category = { $ne: NotificationCategory.Nu };
    } else if (category) {
      throw new BadRequestException('category must be "general" or "nu"');
    }
    const rows = await this.model
      .find(filter)
      .sort({ publishedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map((n) => this.toPublicJson(n));
  }

  async getPublished(id: string) {
    const doc = await this.findOrThrow(id);
    if (doc.status !== NotificationStatus.Published) {
      throw new NotFoundException('Notification not found');
    }
    return this.toPublicJson(doc);
  }

  async create(dto: CreateNotificationDto, userId?: string) {
    const doc = await this.model.create({
      title: dto.title,
      body: dto.body,
      titleBn: dto.titleBn?.trim() || undefined,
      bodyBn: dto.bodyBn?.trim() || undefined,
      category: dto.category ?? NotificationCategory.General,
      ...this.checkedAudience(dto.targetYears, dto.targetDepartments),
      createdBy:
        userId && isValidObjectId(userId)
          ? new Types.ObjectId(userId)
          : undefined,
    });
    if (dto.publish) return this.publish(doc.id);
    return this.toAdminJson(doc);
  }

  /** Marks the notification published and pushes it to every device. Re-publishing re-sends the push. */
  async publish(id: string) {
    const doc = await this.findOrThrow(id);
    doc.status = NotificationStatus.Published;
    doc.publishedAt = doc.publishedAt ?? new Date();
    await this.sendPush(doc);
    await doc.save();
    return this.toAdminJson(doc);
  }

  /**
   * Saves changes. A published notification is marked edited and its push is
   * sent again so users see the new text; a draft is only saved.
   */
  async update(id: string, dto: UpdateNotificationDto) {
    const doc = await this.findOrThrow(id);
    if (dto.title !== undefined) doc.title = dto.title.trim();
    if (dto.body !== undefined) doc.body = dto.body.trim();
    if (dto.titleBn !== undefined)
      doc.titleBn = dto.titleBn.trim() || undefined;
    if (dto.bodyBn !== undefined) doc.bodyBn = dto.bodyBn.trim() || undefined;
    if (dto.category !== undefined) doc.category = dto.category;
    if (dto.targetYears !== undefined || dto.targetDepartments !== undefined) {
      Object.assign(
        doc,
        this.checkedAudience(
          dto.targetYears ?? doc.targetYears,
          dto.targetDepartments ?? doc.targetDepartments,
        ),
      );
    }
    if (!doc.title || !doc.body) {
      throw new BadRequestException('Title and message are required');
    }
    if (doc.status === NotificationStatus.Published) {
      doc.editedAt = new Date();
      await this.sendPush(doc);
    }
    await doc.save();
    return this.toAdminJson(doc);
  }

  /** Cleaned audience lists; rejects year × department picks too large to push. */
  private checkedAudience(years?: string[], departments?: string[]) {
    const audience = {
      targetYears: cleanIds(years),
      targetDepartments: cleanIds(departments),
    };
    if (audienceTopics(audience).length > MAX_AUDIENCE_TOPICS) {
      throw new BadRequestException(
        'Too many year and department combinations. Pick fewer, or leave one of them as "all".',
      );
    }
    return audience;
  }

  /**
   * Sends the push to the devices in the notification's audience (everyone
   * when it has none) and records the outcome on [doc] (not saved).
   */
  private async sendPush(doc: AppNotificationDocument) {
    const edited = doc.editedAt != null;
    const topics = audienceTopics({
      targetYears: doc.targetYears ?? [],
      targetDepartments: doc.targetDepartments ?? [],
    });
    try {
      doc.pushMessageId = await this.firebase.sendToTopics(
        topics,
        {
          title: edited ? `${doc.title} (edited)` : doc.title,
          body: plainLinkText(doc.body),
        },
        {
          type: 'notice',
          notificationId: doc.id,
          category: categoryOf(doc),
          route: '/notices',
          edited: edited ? 'true' : 'false',
        },
      );
      doc.pushError = undefined;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Push for notification ${doc.id} failed: ${msg}`);
      doc.pushError = msg;
    }
  }

  async remove(id: string) {
    const doc = await this.findOrThrow(id);
    await doc.deleteOne();
    return { ok: true };
  }

  private async findOrThrow(id: string) {
    const doc = isValidObjectId(id) ? await this.model.findById(id) : null;
    if (!doc) throw new NotFoundException('Notification not found');
    return doc;
  }

  private toPublicJson(n: AppNotificationDocument) {
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      titleBn: n.titleBn ?? null,
      bodyBn: n.bodyBn ?? null,
      category: categoryOf(n),
      targetYears: n.targetYears ?? [],
      targetDepartments: n.targetDepartments ?? [],
      publishedAt: n.publishedAt?.toISOString() ?? null,
      editedAt: n.editedAt?.toISOString() ?? null,
    };
  }

  private toAdminJson(n: AppNotificationDocument) {
    return {
      ...this.toPublicJson(n),
      status: n.status,
      pushMessageId: n.pushMessageId ?? null,
      pushError: n.pushError ?? null,
      createdAt: n.createdAt?.toISOString() ?? null,
    };
  }
}

export interface AdminNotificationQuery {
  page?: string;
  limit?: string;
  status?: string;
  category?: string;
  q?: string;
}

function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function categoryOf(n: AppNotification): NotificationCategory {
  return n.category === NotificationCategory.Nu
    ? NotificationCategory.Nu
    : NotificationCategory.General;
}

/** `[label](url)` becomes `label`, so the push banner shows readable text. */
function plainLinkText(text: string): string {
  return text.replace(/\[([^\]\n]+)\]\((?:https?:\/\/|www\.)[^\s)]+\)/gi, '$1');
}
