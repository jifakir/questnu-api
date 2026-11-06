import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { FirebaseAdminService } from '../../firebase/firebase-admin.service';
import { CreateNotificationDto } from './dto/notification.dto';
import {
  AppNotification,
  AppNotificationDocument,
  NotificationStatus,
} from './notification.schema';

/** FCM topic every QuestNU app install subscribes to. Keep in sync with the app. */
export const ALL_USERS_TOPIC = 'all-users';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(AppNotification.name)
    private readonly model: Model<AppNotification>,
    private readonly firebase: FirebaseAdminService,
  ) {}

  async listAll() {
    const rows = await this.model.find().sort({ createdAt: -1 }).limit(200);
    return rows.map((n) => this.toAdminJson(n));
  }

  async listPublished(limit = 50) {
    const rows = await this.model
      .find({ status: NotificationStatus.Published })
      .sort({ publishedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map((n) => this.toPublicJson(n));
  }

  async create(dto: CreateNotificationDto, userId?: string) {
    const doc = await this.model.create({
      title: dto.title,
      body: dto.body,
      titleBn: dto.titleBn?.trim() || undefined,
      bodyBn: dto.bodyBn?.trim() || undefined,
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
    try {
      doc.pushMessageId = await this.firebase.sendToTopic(
        ALL_USERS_TOPIC,
        { title: doc.title, body: doc.body },
        { type: 'notice', notificationId: doc.id, route: '/notices' },
      );
      doc.pushError = undefined;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Push for notification ${doc.id} failed: ${msg}`);
      doc.pushError = msg;
    }
    await doc.save();
    return this.toAdminJson(doc);
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
      id: n.id as string,
      title: n.title,
      body: n.body,
      titleBn: n.titleBn ?? null,
      bodyBn: n.bodyBn ?? null,
      publishedAt: n.publishedAt?.toISOString() ?? null,
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
