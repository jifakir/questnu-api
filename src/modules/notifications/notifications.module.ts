import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FirebaseModule } from '../../firebase/firebase.module';
import { AppNotification, AppNotificationSchema } from './notification.schema';
import {
  AdminNotificationsController,
  NotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    FirebaseModule,
    MongooseModule.forFeature([
      { name: AppNotification.name, schema: AppNotificationSchema },
    ]),
  ],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
