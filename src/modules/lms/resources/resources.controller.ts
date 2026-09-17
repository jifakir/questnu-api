import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import type { Express } from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '../../../users/user.schema';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { UploadResourceMetaDto } from './dto/upload-resource-meta.dto';

const upload = memoryStorage();

@Controller('resources')
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Instructor, UserRole.Admin)
  create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Instructor, UserRole.Admin)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: upload,
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  upload(
    @Body() body: UploadResourceMetaDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.resourcesService.upload(file, body);
  }

  @Get()
  list(
    @Query('courseId') courseId?: string,
    @Query('moduleId') moduleId?: string,
    @Query('lessonId') lessonId?: string,
  ) {
    return this.resourcesService.list({ courseId, moduleId, lessonId });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  @Get(':id/file')
  async file(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mime, filename } =
      await this.resourcesService.streamFile(id);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );
    return new StreamableFile(stream, { type: mime });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Instructor, UserRole.Admin)
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Instructor, UserRole.Admin)
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }
}
