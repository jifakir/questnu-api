import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import {
  CreateNotificationDto,
  UpdateNotificationDto,
} from './dto/notification.dto';
import {
  NotificationsService,
  type AdminNotificationQuery,
} from './notifications.service';

/** Published notifications, read by the mobile app (no sign-in needed). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('year') year?: string,
    @Query('department') department?: string,
  ) {
    return this.service.listPublished(
      Number(limit) || 50,
      category,
      year,
      department,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.getPublished(id);
  }
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  /** `?page=1&limit=20&status=draft|published&category=general|nu&q=text` */
  @Get()
  list(@Query() query: AdminNotificationQuery) {
    return this.service.listAll(query);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateNotificationDto,
  ) {
    return this.service.create(dto, user.id);
  }

  /** Edits a notification. If it is published, the push is sent again. */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNotificationDto) {
    return this.service.update(id, dto);
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
