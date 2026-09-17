import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../../auth/decorators/current-user.decorator';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('courses')
  list() {
    return this.catalogService.listPublished();
  }

  @Get('courses/:id')
  preview(@Param('id') id: string) {
    return this.catalogService.previewCourse(id);
  }

  @Get('courses/:id/learn')
  learn(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.catalogService.learnCourse(user, id);
  }
}
