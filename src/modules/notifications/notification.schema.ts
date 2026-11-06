import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum NotificationStatus {
  Draft = 'draft',
  Published = 'published',
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

  @Prop({ type: Date, index: true })
  publishedAt?: Date;

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
