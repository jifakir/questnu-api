import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum NotificationStatus {
  Draft = 'draft',
  Published = 'published',
}

/** Which list the app shows a notification in. */
export enum NotificationCategory {
  /** QuestNU news and general notices ("Recent Notice"). */
  General = 'general',
  /** Important National University notices ("NU Latest"). */
  Nu = 'nu',
}

export type AppNotificationDocument = HydratedDocument<AppNotification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class AppNotification {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  body: string;

  @Prop({ trim: true })
  titleBn?: string;

  @Prop({ trim: true })
  bodyBn?: string;

  @Prop({
    type: String,
    enum: NotificationStatus,
    default: NotificationStatus.Draft,
    index: true,
  })
  status: NotificationStatus;

  /** Older notifications have no category and count as general. */
  @Prop({
    type: String,
    enum: NotificationCategory,
    default: NotificationCategory.General,
    index: true,
  })
  category: NotificationCategory;

  /** Years (e.g. "2") this is for. Empty means every year. */
  @Prop({ type: [String], default: [], index: true })
  targetYears: string[];

  /** Department slugs this is for. Empty means every department. */
  @Prop({ type: [String], default: [], index: true })
  targetDepartments: string[];

  @Prop({ type: Date, index: true })
  publishedAt?: Date;

  /** Set when a published notification is changed; the app shows an "Edited" tag. */
  @Prop({ type: Date })
  editedAt?: Date;

  /** FCM message id of the last successful push. */
  @Prop()
  pushMessageId?: string;

  /** Error from the last push attempt, if it failed. */
  @Prop()
  pushError?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AppNotificationSchema =
  SchemaFactory.createForClass(AppNotification);
