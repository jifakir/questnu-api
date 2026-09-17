import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { PapersService } from './papers.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ReviewPaperDto } from './dto/review-paper.dto';
import { UploadPaperBodyDto } from './dto/upload-paper-body.dto';
import { UserRole } from '../../../users/user.schema';
import type { JwtPayloadUser } from '../../../auth/decorators/current-user.decorator';

const upload = memoryStorage();

@Controller('papers')
@UseGuards(JwtAuthGuard)
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Student)
  @UseInterceptors(
    FilesInterceptor('images', 12, {
      storage: upload,
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: UploadPaperBodyDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.papersService.createFromUploads(user, files ?? [], body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayloadUser) {
    return this.papersService.findAllForUser(user);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.papersService.findOneForUser(user, id);
  }

  @Get(':id/images/:index')
  async getImage(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<StreamableFile> {
    const { stream, mime } = await this.papersService.getImageStream(
      user,
      id,
      index,
    );
    return new StreamableFile(stream, { type: mime, disposition: 'inline' });
  }

  @Patch(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Instructor, UserRole.Admin)
  review(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: ReviewPaperDto,
  ) {
    const feedback = this.papersService.validateFeedbackPayload(dto.feedback);
    return this.papersService.reviewPaper(user, id, feedback, dto.approve);
  }
}
