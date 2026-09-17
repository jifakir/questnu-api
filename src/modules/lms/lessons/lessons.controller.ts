import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '../../../users/user.schema';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Instructor, UserRole.Admin)
@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post('modules/:moduleId/lessons')
  create(@Param('moduleId') moduleId: string, @Body() dto: CreateLessonDto) {
    return this.lessonsService.create(moduleId, dto);
  }

  @Get('modules/:moduleId/lessons')
  list(@Param('moduleId') moduleId: string) {
    return this.lessonsService.listForModule(moduleId);
  }

  @Post('modules/:moduleId/lessons/reorder')
  reorder(
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.lessonsService.reorder(moduleId, dto.lessonIds);
  }

  @Get('courses/:courseId/lessons')
  listForCourse(@Param('courseId') courseId: string) {
    return this.lessonsService.listForCourse(courseId);
  }

  @Get('lessons/:id')
  getOne(@Param('id') id: string) {
    return this.lessonsService.findOne(id);
  }

  @Patch('lessons/:id')
  update(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.lessonsService.update(id, dto);
  }

  @Delete('lessons/:id')
  remove(@Param('id') id: string) {
    return this.lessonsService.remove(id);
  }
}
