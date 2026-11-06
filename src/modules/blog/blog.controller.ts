import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/user.schema';
import { BlogLocale } from './blog-post.schema';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog-post.dto';
import { BlogService } from './blog.service';

function toLocale(value?: string): BlogLocale {
  return value === 'en' ? 'en' : 'bn';
}

/** Published posts and images, read by the public website (no sign-in needed). */
@Controller('blog')
export class BlogController {
  constructor(private readonly service: BlogService) {}

  @Get('posts')
  list(@Query('locale') locale?: string, @Query('limit') limit?: string) {
    return this.service.listPublished(toLocale(locale), Number(limit) || 100);
  }

  @Get('posts/:slug')
  findOne(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.service.getPublished(slug, toLocale(locale));
  }

  /** Every upload gets a unique name, so images can be cached forever. */
  @Get('images/:file')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async image(@Param('file') file: string) {
    const { stream, type } = await this.service.openImage(file);
    return new StreamableFile(stream, { type, disposition: 'inline' });
  }
}

@Controller('admin/blog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminBlogController {
  constructor(private readonly service: BlogService) {}

  @Get('posts')
  list() {
    return this.service.listAll();
  }

  @Get('posts/:id')
  findOne(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post('posts')
  create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateBlogPostDto) {
    return this.service.create(dto, user.id);
  }

  @Patch('posts/:id')
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.service.update(id, dto);
  }

  @Post('posts/:id/publish')
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }

  @Post('posts/:id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.service.unpublish(id);
  }

  @Delete('posts/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    return this.service.saveImage(file);
  }
}
