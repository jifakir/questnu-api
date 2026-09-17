import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from './user.schema';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const upload = memoryStorage();

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Student)
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayloadUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  patchMe(@CurrentUser() user: JwtPayloadUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: upload,
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  postAvatar(
    @CurrentUser() user: JwtPayloadUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.setAvatarFromUpload(user.id, file);
  }

  @Get('me/avatar')
  async getAvatar(@CurrentUser() user: JwtPayloadUser): Promise<StreamableFile> {
    const { stream, mime } = await this.usersService.getAvatarStreamForUser(user.id);
    return new StreamableFile(stream, { type: mime, disposition: 'inline' });
  }
}
