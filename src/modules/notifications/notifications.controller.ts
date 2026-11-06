import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/user.schema';
import { CreateNotificationDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

/** Published notifications, read by the mobile app (no sign-in needed). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.service.listPublished(Number(limit) || 50);
  }
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list() {
    return this.service.listAll();
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.service.create(dto, user.id);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
